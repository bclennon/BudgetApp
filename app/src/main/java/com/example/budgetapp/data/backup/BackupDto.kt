package com.example.budgetapp.data.backup

import kotlinx.serialization.Serializable

@Serializable
data class BackupDto(
    val schemaVersion: Int = 1,
    val exportedAt: String,
    val settings: PaySettingsDto?,
    val bills: List<BillDto>
)

@Serializable
data class BillDto(
    val id: Long,
    val name: String,
    val dayOfMonth: Int,
    val amountCents: Long
)

@Serializable
data class PaySettingsDto(
    val paycheckAmountCents: Long,
    val frequency: String,
    val nextPayday: String,
    val targetSpendingPerDayCents: Long
)
