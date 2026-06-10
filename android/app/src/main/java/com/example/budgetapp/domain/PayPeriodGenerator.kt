package com.example.budgetapp.domain

import java.util.concurrent.TimeUnit

// ── Date helpers ──────────────────────────────────────────────────────────────

private data class DateParts(val year: Int, val month: Int, val day: Int)

private fun parseDate(dateStr: String): DateParts {
    val parts = dateStr.split("-")
    return DateParts(parts[0].toInt(), parts[1].toInt(), parts[2].toInt())
}

private fun addDays(dateStr: String, days: Int): String {
    val (y, m, d) = parseDate(dateStr)
    val cal = java.util.Calendar.getInstance().apply {
        set(y, m - 1, d)
        add(java.util.Calendar.DAY_OF_MONTH, days)
    }
    return "%04d-%02d-%02d".format(
        cal.get(java.util.Calendar.YEAR),
        cal.get(java.util.Calendar.MONTH) + 1,
        cal.get(java.util.Calendar.DAY_OF_MONTH)
    )
}

fun daysBetween(start: String, end: String): Int {
    val (sy, sm, sd) = parseDate(start)
    val (ey, em, ed) = parseDate(end)
    val startCal = java.util.Calendar.getInstance().apply { set(sy, sm - 1, sd) }
    val endCal = java.util.Calendar.getInstance().apply { set(ey, em - 1, ed) }
    val diffMs = endCal.timeInMillis - startCal.timeInMillis
    return TimeUnit.MILLISECONDS.toDays(diffMs).toInt()
}

private fun nextSemiMonthlyPayday(current: String): String {
    val (year, month, day) = parseDate(current)
    return when {
        day == 15 -> resolveDueDate(year, month, 30)
        day > 15 -> {
            val nm = if (month == 12) 1 else month + 1
            val ny = if (month == 12) year + 1 else year
            "%04d-%02d-15".format(ny, nm)
        }
        else -> "%04d-%02d-15".format(year, month)
    }
}

fun nextPayday(current: String, frequency: Frequency): String {
    val (year, month, day) = parseDate(current)
    return when (frequency) {
        Frequency.WEEKLY -> addDays(current, 7)
        Frequency.BIWEEKLY -> addDays(current, 14)
        Frequency.SEMI_MONTHLY -> nextSemiMonthlyPayday(current)
        Frequency.MONTHLY -> {
            val nm = if (month == 12) 1 else month + 1
            val ny = if (month == 12) year + 1 else year
            resolveDueDate(ny, nm, day)
        }
    }
}

// ── Main generator ────────────────────────────────────────────────────────────

fun generatePayPeriods(
    settings: PaySettings,
    bills: List<Bill>,
    count: Int = 24,
    overrides: PeriodOverrides = emptyMap()
): List<PayPeriod> {
    val periods = mutableListOf<PayPeriod>()
    var currentStart = settings.nextPayday

    repeat(count) {
        val nextPay = nextPayday(currentStart, settings.frequency)
        val currentEnd = addDays(nextPay, -1)
        val daysInPeriod = daysBetween(currentStart, currentEnd) + 1

        val override = overrides[currentStart]
        val effectivePaycheckCents = override?.paycheckAmountCents ?: settings.paycheckAmountCents
        val movedOutIds = buildSet {
            addAll(override?.movedOutBillIds ?: emptyList())
            addAll(override?.deletedBillIds ?: emptyList())
        }
        val amountOverrides = override?.billAmountOverrides ?: emptyMap()

        val startParts = parseDate(currentStart)
        val endParts = parseDate(currentEnd)
        val monthsToCheck = buildList {
            add(startParts.year to startParts.month)
            if (startParts.year != endParts.year || startParts.month != endParts.month) {
                add(endParts.year to endParts.month)
            }
        }

        val billsInPeriod = mutableListOf<BillInPeriod>()

        // Recurring bills (skip those moved out of this period)
        for (bill in bills) {
            if (bill.id in movedOutIds) continue
            for ((year, month) in monthsToCheck) {
                val dueDate = resolveDueDate(year, month, bill.dayOfMonth)
                if (dueDate >= currentStart && dueDate <= currentEnd) {
                    val key = bill.id.toString()
                    billsInPeriod.add(
                        BillInPeriod(
                            bill = bill,
                            dueDate = dueDate,
                            amountOverrideCents = amountOverrides[key]
                        )
                    )
                    break
                }
            }
        }

        // Bills moved into this period from another period
        val billMap = bills.associateBy { it.id }
        for (moved in override?.movedInBills ?: emptyList()) {
            val bill = billMap[moved.billId] ?: continue
            val key = bill.id.toString()
            billsInPeriod.add(
                BillInPeriod(
                    bill = bill,
                    dueDate = moved.dueDate,
                    movedFromPeriod = moved.fromPeriodStart,
                    amountOverrideCents = amountOverrides[key]
                )
            )
        }

        // One-time bills manually added to this period
        for (ot in override?.oneTimeBills ?: emptyList()) {
            billsInPeriod.add(
                BillInPeriod(
                    bill = Bill(id = 0, name = ot.name, amountCents = ot.amountCents, dayOfMonth = 0),
                    dueDate = ot.dueDate,
                    isOneTime = true,
                    oneTimeBillId = ot.id
                )
            )
        }

        // Sort by due date
        billsInPeriod.sortBy { it.dueDate }

        val billPaymentStatuses = override?.billPaymentStatuses ?: emptyMap()
        val billsTotalCents = billsInPeriod.sumOf { b ->
            val key = if (b.isOneTime) b.oneTimeBillId!! else b.bill.id.toString()
            if (billPaymentStatuses[key] == BillPaymentStatus.PROCESSED) 0
            else (b.amountOverrideCents ?: b.bill.amountCents)
        }
        val remainingCents = effectivePaycheckCents - billsTotalCents
        val spendingPerDayRaw = if (daysInPeriod > 0) remainingCents / daysInPeriod else 0
        val minSpendPerDay = settings.minSpendPerDayCents
        val hasSurplus = minSpendPerDay > 0 && spendingPerDayRaw > minSpendPerDay
        val surplusCents = if (hasSurplus) (spendingPerDayRaw - minSpendPerDay) * daysInPeriod else 0
        val displayedSpendingPerDay = if (hasSurplus) minSpendPerDay else spendingPerDayRaw

        periods.add(
            PayPeriod(
                startDate = currentStart,
                endDate = currentEnd,
                bills = billsInPeriod,
                paycheckAmountCents = effectivePaycheckCents,
                billsTotalCents = billsTotalCents,
                remainingCents = remainingCents,
                daysInPeriod = daysInPeriod,
                spendingPerDayRaw = spendingPerDayRaw,
                displayedSpendingPerDay = displayedSpendingPerDay,
                surplusCents = surplusCents,
                hasSurplus = hasSurplus
            )
        )

        currentStart = nextPay
    }

    return periods
}
