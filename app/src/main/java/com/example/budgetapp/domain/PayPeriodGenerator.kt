package com.example.budgetapp.domain

import com.example.budgetapp.domain.model.*
import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.ChronoUnit

object PayPeriodGenerator {

    fun generate(settings: PaySettings, bills: List<Bill>, count: Int = 6): List<PayPeriod> {
        val periods = mutableListOf<PayPeriod>()
        var currentStart = settings.nextPayday

        repeat(count) {
            val nextPayday = nextPayday(currentStart, settings.frequency)
            val currentEnd = nextPayday.minusDays(1)

            val daysInPeriod = ChronoUnit.DAYS.between(currentStart, currentEnd).toInt() + 1

            val billsInPeriod = mutableListOf<BillInPeriod>()
            val monthsToCheck = mutableSetOf<YearMonth>()
            monthsToCheck.add(YearMonth.from(currentStart))
            monthsToCheck.add(YearMonth.from(currentEnd))

            for (bill in bills) {
                for (ym in monthsToCheck) {
                    val dueDate = BillDueDateResolver.resolveDueDate(ym.year, ym.month, bill.dayOfMonth)
                    if (!dueDate.isBefore(currentStart) && !dueDate.isAfter(currentEnd)) {
                        billsInPeriod.add(BillInPeriod(bill, dueDate))
                        break
                    }
                }
            }

            val billsTotal = billsInPeriod.sumOf { it.bill.amountCents }
            val remaining = settings.paycheckAmountCents - billsTotal
            val spendingPerDayRaw = if (daysInPeriod > 0) remaining / daysInPeriod else 0L

            val hasSavings = spendingPerDayRaw > settings.targetSpendingPerDayCents
            val savingsTotal = if (hasSavings) {
                (spendingPerDayRaw - settings.targetSpendingPerDayCents) * daysInPeriod
            } else 0L
            val displayedSpendingPerDay = if (hasSavings) settings.targetSpendingPerDayCents else spendingPerDayRaw

            periods.add(
                PayPeriod(
                    startDate = currentStart,
                    endDate = currentEnd,
                    bills = billsInPeriod,
                    paycheckAmountCents = settings.paycheckAmountCents,
                    billsTotalCents = billsTotal,
                    remainingCents = remaining,
                    daysInPeriod = daysInPeriod,
                    spendingPerDayRaw = spendingPerDayRaw,
                    displayedSpendingPerDay = displayedSpendingPerDay,
                    savingsTotalCents = savingsTotal,
                    hasSavings = hasSavings
                )
            )

            currentStart = nextPayday
        }

        return periods
    }

    fun nextPayday(current: LocalDate, frequency: Frequency): LocalDate {
        return when (frequency) {
            Frequency.WEEKLY -> current.plusDays(7)
            Frequency.BIWEEKLY -> current.plusDays(14)
            Frequency.SEMI_MONTHLY -> nextSemiMonthlyPayday(current)
            Frequency.MONTHLY -> nextMonthlyPayday(current)
        }
    }

    private fun nextSemiMonthlyPayday(current: LocalDate): LocalDate {
        return when {
            current.dayOfMonth == 15 -> {
                // On the 15th: next is the 30th of the same month (with overflow if needed)
                BillDueDateResolver.resolveDueDate(current.year, current.month, 30)
            }
            current.dayOfMonth > 15 -> {
                // On the 30th (or any second-half day): next is the 15th of next month
                val nextMonth = current.plusMonths(1)
                LocalDate.of(nextMonth.year, nextMonth.month, 15)
            }
            else -> {
                // Day < 15: overflowed from previous month's 30th slot → next is 15th of current month
                LocalDate.of(current.year, current.month, 15)
            }
        }
    }

    private fun nextMonthlyPayday(current: LocalDate): LocalDate {
        val next = current.plusMonths(1)
        return BillDueDateResolver.resolveDueDate(next.year, next.month, current.dayOfMonth)
    }
}
