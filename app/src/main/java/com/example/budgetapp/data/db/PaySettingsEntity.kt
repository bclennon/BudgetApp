package com.example.budgetapp.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pay_settings")
data class PaySettingsEntity(
    @PrimaryKey val id: Int = 1,
    val paycheckAmountCents: Long,
    val frequency: String,
    val nextPayday: String,
    val targetSpendingPerDayCents: Long
)
