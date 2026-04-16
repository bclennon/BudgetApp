package com.example.budgetapp.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.budgetapp.BudgetApplication
import com.example.budgetapp.data.db.PaySettingsEntity
import com.example.budgetapp.domain.model.Frequency
import com.example.budgetapp.domain.model.PaySettings
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.LocalDate

class SettingsViewModel(application: Application) : AndroidViewModel(application) {

    private val paySettingsDao = (application as BudgetApplication).database.paySettingsDao()

    val settings: StateFlow<PaySettings?> = paySettingsDao.getPaySettings()
        .map { entity ->
            entity?.let {
                try {
                    PaySettings(
                        paycheckAmountCents = it.paycheckAmountCents,
                        frequency = Frequency.valueOf(it.frequency),
                        nextPayday = LocalDate.parse(it.nextPayday),
                        targetSpendingPerDayCents = it.targetSpendingPerDayCents
                    )
                } catch (e: Exception) { null }
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    fun saveSettings(settings: PaySettings) {
        viewModelScope.launch {
            paySettingsDao.insertOrUpdatePaySettings(
                PaySettingsEntity(
                    id = 1,
                    paycheckAmountCents = settings.paycheckAmountCents,
                    frequency = settings.frequency.name,
                    nextPayday = settings.nextPayday.toString(),
                    targetSpendingPerDayCents = settings.targetSpendingPerDayCents
                )
            )
        }
    }
}
