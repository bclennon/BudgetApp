package com.example.budgetapp.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.budgetapp.BudgetApplication
import com.example.budgetapp.data.db.BillEntity
import com.example.budgetapp.domain.PayPeriodGenerator
import com.example.budgetapp.domain.model.*
import kotlinx.coroutines.flow.*
import java.time.LocalDate

class PayPeriodsViewModel(application: Application) : AndroidViewModel(application) {

    private val db = (application as BudgetApplication).database
    private val billDao = db.billDao()
    private val paySettingsDao = db.paySettingsDao()

    val payPeriods: StateFlow<List<PayPeriod>> = combine(
        billDao.getAllBills(),
        paySettingsDao.getPaySettings()
    ) { billEntities, settingsEntity ->
        if (settingsEntity == null) return@combine emptyList()
        val bills = billEntities.map { it.toDomain() }
        val settings = settingsEntity.toDomain() ?: return@combine emptyList()
        PayPeriodGenerator.generate(settings, bills)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private fun BillEntity.toDomain() = Bill(id, name, dayOfMonth, amountCents)

    private fun com.example.budgetapp.data.db.PaySettingsEntity.toDomain(): PaySettings? {
        return try {
            PaySettings(
                paycheckAmountCents = paycheckAmountCents,
                frequency = Frequency.valueOf(frequency),
                nextPayday = LocalDate.parse(nextPayday),
                targetSpendingPerDayCents = targetSpendingPerDayCents
            )
        } catch (e: Exception) { null }
    }
}
