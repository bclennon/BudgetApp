package com.example.budgetapp.domain.model

import java.time.LocalDate

data class BillInPeriod(
    val bill: Bill,
    val dueDate: LocalDate
)

data class PayPeriod(
    val startDate: LocalDate,
    val endDate: LocalDate,
    val bills: List<BillInPeriod>,
    val paycheckAmountCents: Long,
    val billsTotalCents: Long,
    val remainingCents: Long,
    val daysInPeriod: Int,
    val spendingPerDayRaw: Long,
    val displayedSpendingPerDay: Long,
    val savingsTotalCents: Long,
    val hasSavings: Boolean
)
