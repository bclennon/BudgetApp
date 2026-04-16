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
        ).build()
    }
}
