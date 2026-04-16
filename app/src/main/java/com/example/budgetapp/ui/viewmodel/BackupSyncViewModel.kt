package com.example.budgetapp.ui.viewmodel

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.budgetapp.BudgetApplication
import com.example.budgetapp.data.backup.BackupDto
import com.example.budgetapp.data.backup.BackupManager
import com.example.budgetapp.data.backup.BillDto
import com.example.budgetapp.data.backup.PaySettingsDto
import com.example.budgetapp.data.db.BillEntity
import com.example.budgetapp.data.db.PaySettingsEntity
import com.example.budgetapp.data.preferences.BackupPreferences
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.Instant

data class BackupUiState(
    val backupUri: String? = null,
    val lastSyncAt: String? = null,
    val statusMessage: String? = null,
    val isLoading: Boolean = false
)

class BackupSyncViewModel(application: Application) : AndroidViewModel(application) {

    private val db = (application as BudgetApplication).database
    private val backupManager = BackupManager(application.contentResolver)

    private val _uiState = MutableStateFlow(BackupUiState())
    val uiState: StateFlow<BackupUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            combine(
                BackupPreferences.getBackupUri(application),
                BackupPreferences.getLastSyncAt(application)
            ) { uri, lastSync -> BackupUiState(backupUri = uri, lastSyncAt = lastSync) }
                .collect { state -> _uiState.update { state } }
        }
    }

    fun setBackupUri(uri: Uri) {
        viewModelScope.launch {
            BackupPreferences.setBackupUri(getApplication(), uri.toString())
        }
    }

    fun syncToBackup() {
        viewModelScope.launch {
            val uriString = _uiState.value.backupUri ?: run {
                _uiState.update { it.copy(statusMessage = "No backup file selected") }
                return@launch
            }
            _uiState.update { it.copy(isLoading = true) }
            try {
                val bills = db.billDao().getAllBills().first()
                val settings = db.paySettingsDao().getPaySettings().first()
                val backup = BackupDto(
                    exportedAt = Instant.now().toString(),
                    settings = settings?.let {
                        PaySettingsDto(it.paycheckAmountCents, it.frequency, it.nextPayday, it.targetSpendingPerDayCents)
                    },
                    bills = bills.map { BillDto(it.id, it.name, it.dayOfMonth, it.amountCents) }
                )
                backupManager.writeBackup(Uri.parse(uriString), backup)
                val now = Instant.now().toString()
                BackupPreferences.setLastSyncAt(getApplication(), now)
                _uiState.update { it.copy(isLoading = false, statusMessage = "Backup saved successfully", lastSyncAt = now) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, statusMessage = "Backup failed: ${e.message}") }
            }
        }
    }

    fun restoreFromBackup() {
        viewModelScope.launch {
            val uriString = _uiState.value.backupUri ?: run {
                _uiState.update { it.copy(statusMessage = "No backup file selected") }
                return@launch
            }
            _uiState.update { it.copy(isLoading = true) }
            try {
                val backup = backupManager.readBackup(Uri.parse(uriString))
                val billDao = db.billDao()
                billDao.deleteAllBills()
                backup.bills.forEach {
                    billDao.insertBill(BillEntity(name = it.name, dayOfMonth = it.dayOfMonth, amountCents = it.amountCents))
                }
                backup.settings?.let { s ->
                    db.paySettingsDao().insertOrUpdatePaySettings(
                        PaySettingsEntity(
                            id = 1,
                            paycheckAmountCents = s.paycheckAmountCents,
                            frequency = s.frequency,
                            nextPayday = s.nextPayday,
                            targetSpendingPerDayCents = s.targetSpendingPerDayCents
                        )
                    )
                }
                val now = Instant.now().toString()
                BackupPreferences.setLastSyncAt(getApplication(), now)
                _uiState.update { it.copy(isLoading = false, statusMessage = "Restore successful", lastSyncAt = now) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, statusMessage = "Restore failed: ${e.message}") }
            }
        }
    }

    fun clearStatus() {
        _uiState.update { it.copy(statusMessage = null) }
    }
}
