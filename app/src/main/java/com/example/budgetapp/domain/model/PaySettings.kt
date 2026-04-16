package com.example.budgetapp.domain.model

import java.time.LocalDate

data class PaySettings(
    val paycheckAmountCents: Long,
    val frequency: Frequency,
    val nextPayday: LocalDate,
    val targetSpendingPerDayCents: Long
)
