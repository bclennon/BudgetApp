package com.example.budgetapp

import android.app.Application
import androidx.room.Room
import com.example.budgetapp.data.db.AppDatabase

class BudgetApplication : Application() {

    lateinit var database: AppDatabase
        private set

    override fun onCreate() {
        super.onCreate()
        database = Room.databaseBuilder(
            applicationContext,
            AppDatabase::class.java,
            "budget_database"
        )
            // Recreates the database if the schema changes without a migration path.
            // This prevents the IllegalStateException crash caused by a schema hash
            // mismatch (e.g., after modifying entities during development).
            // Note: this will clear all local data when a schema change is detected.
            .fallbackToDestructiveMigration()
            .build()
    }
}
