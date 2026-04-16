package com.example.budgetapp.data.db

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [BillEntity::class, PaySettingsEntity::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun billDao(): BillDao
    abstract fun paySettingsDao(): PaySettingsDao
}
