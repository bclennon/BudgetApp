package com.example.budgetapp.ui

import android.app.Application
import android.content.Intent
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.budgetapp.auth.AuthManager
import com.example.budgetapp.data.SheetTabsNotFoundError
import com.example.budgetapp.data.SheetsRepository
import com.example.budgetapp.domain.*
import com.google.firebase.auth.FirebaseUser
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID

// ── UI State ──────────────────────────────────────────────────────────────────

data class AppUiState(
    val isSignedIn: Boolean = false,
    val isLoading: Boolean = false,
    val loadError: String? = null,
    val bills: List<Bill> = emptyList(),
    val settings: PaySettings? = null,
    val periodOverrides: PeriodOverrides = emptyMap(),
    val creditCards: List<CreditCard> = emptyList(),
    val spreadsheetId: String? = null,
    val saveError: String? = null
)

// ── ViewModel ─────────────────────────────────────────────────────────────────

class AppViewModel(application: Application) : AndroidViewModel(application) {

    val authManager = AuthManager(application)
    private val sheetsRepository = SheetsRepository(application)

    private val _uiState = MutableStateFlow(AppUiState())
    val uiState: StateFlow<AppUiState> = _uiState.asStateFlow()

    private var currentUser: FirebaseUser? = null
    private var sheetsToken: String? = null

    init {
        // Observe Firebase Auth state changes
        authManager.addAuthStateListener { auth ->
            val user = auth.currentUser
            currentUser = user
            if (user != null) {
                _uiState.update { it.copy(isSignedIn = true) }
                loadData()
            } else {
                _uiState.update { AppUiState(isSignedIn = false) }
                sheetsToken = null
            }
        }
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    /** Returns the Google Sign-In intent to launch. */
    fun buildSignInIntent(): Intent = authManager.buildSignInIntent()

    /** Called after the sign-in activity returns a result. */
    fun handleSignInResult(data: Intent?) {
        viewModelScope.launch {
            try {
                authManager.handleSignInResult(data)
                // Auth state listener will trigger loadData()
            } catch (e: Exception) {
                _uiState.update { it.copy(loadError = "Sign-in failed: ${e.message}") }
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            authManager.signOut()
        }
    }

    // ── Data loading ──────────────────────────────────────────────────────────

    private fun loadData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, loadError = null) }
            try {
                val token = refreshToken() ?: return@launch
                val uid = currentUser?.uid ?: return@launch
                val spreadsheetId = sheetsRepository.getOrCreateSpreadsheet(token, uid)

                try {
                    val data = sheetsRepository.loadAllFromSheets(token, spreadsheetId)
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            spreadsheetId = spreadsheetId,
                            bills = data.bills ?: emptyList(),
                            settings = data.settings,
                            periodOverrides = data.periodOverrides ?: emptyMap(),
                            creditCards = data.creditCards ?: emptyList()
                        )
                    }
                } catch (e: SheetTabsNotFoundError) {
                    // Spreadsheet exists but is missing tabs — add them then reload.
                    sheetsRepository.addSheetTabsToSpreadsheet(token, spreadsheetId, e.missingTabs)
                    val data = sheetsRepository.loadAllFromSheets(token, spreadsheetId)
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            spreadsheetId = spreadsheetId,
                            bills = data.bills ?: emptyList(),
                            settings = data.settings,
                            periodOverrides = data.periodOverrides ?: emptyMap(),
                            creditCards = data.creditCards ?: emptyList()
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, loadError = e.message ?: "Failed to load data.")
                }
            }
        }
    }

    fun reload() = loadData()

    private suspend fun refreshToken(): String? {
        return try {
            val token = authManager.getSheetsAccessToken()
            sheetsToken = token
            token
        } catch (e: Exception) {
            _uiState.update {
                it.copy(isLoading = false, loadError = "Could not obtain access token: ${e.message}")
            }
            null
        }
    }

    private fun getToken(): String? = sheetsToken

    // ── Save helpers ──────────────────────────────────────────────────────────

    private fun save(block: suspend (String, String) -> Unit) {
        viewModelScope.launch {
            val token = getToken() ?: refreshToken() ?: return@launch
            val spreadsheetId = _uiState.value.spreadsheetId ?: return@launch
            try {
                block(token, spreadsheetId)
                _uiState.update { it.copy(saveError = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(saveError = e.message ?: "Save failed.") }
            }
        }
    }

    // ── Bills ─────────────────────────────────────────────────────────────────

    private fun getNextBillId(bills: List<Bill>): Int =
        if (bills.isEmpty()) 1 else bills.maxOf { it.id } + 1

    fun addBill(name: String, dayOfMonth: Int, amountCents: Int, url: String) {
        val current = _uiState.value.bills
        val newBill = Bill(
            id = getNextBillId(current),
            name = name,
            dayOfMonth = dayOfMonth,
            amountCents = amountCents,
            url = url.takeIf { it.isNotBlank() }
        )
        val updated = current + newBill
        _uiState.update { it.copy(bills = updated) }
        save { token, id -> sheetsRepository.saveBillsToSheets(token, id, updated) }
    }

    fun updateBill(bill: Bill) {
        val updated = _uiState.value.bills.map { if (it.id == bill.id) bill else it }
        _uiState.update { it.copy(bills = updated) }
        save { token, id -> sheetsRepository.saveBillsToSheets(token, id, updated) }
    }

    fun deleteBill(billId: Int) {
        val updated = _uiState.value.bills.filter { it.id != billId }
        _uiState.update { it.copy(bills = updated) }
        save { token, id -> sheetsRepository.saveBillsToSheets(token, id, updated) }
    }

    fun importBills(items: List<ParsedBillRow>) {
        val current = _uiState.value.bills.toMutableList()
        var nextId = getNextBillId(current)
        for (item in items.filter { it.error == null }) {
            current.add(Bill(id = nextId++, name = item.name, dayOfMonth = item.dayOfMonth, amountCents = item.amountCents))
        }
        _uiState.update { it.copy(bills = current) }
        save { token, id -> sheetsRepository.saveBillsToSheets(token, id, current) }
    }

    // ── Settings ──────────────────────────────────────────────────────────────

    fun saveSettings(settings: PaySettings) {
        _uiState.update { it.copy(settings = settings) }
        save { token, id -> sheetsRepository.saveSettingsToSheets(token, id, settings) }
    }

    // ── Credit cards ──────────────────────────────────────────────────────────

    fun addCreditCard(name: String, balanceCents: Int, transferExpirationDate: String?) {
        val newCard = CreditCard(
            id = UUID.randomUUID().toString(),
            name = name,
            balanceCents = balanceCents,
            transferExpirationDate = transferExpirationDate
        )
        val updated = _uiState.value.creditCards + newCard
        _uiState.update { it.copy(creditCards = updated) }
        save { token, id -> sheetsRepository.saveCreditCardsToSheets(token, id, updated) }
    }

    fun updateCreditCard(card: CreditCard) {
        val updated = _uiState.value.creditCards.map { if (it.id == card.id) card else it }
        _uiState.update { it.copy(creditCards = updated) }
        save { token, id -> sheetsRepository.saveCreditCardsToSheets(token, id, updated) }
    }

    fun deleteCreditCard(cardId: String) {
        val updated = _uiState.value.creditCards.filter { it.id != cardId }
        _uiState.update { it.copy(creditCards = updated) }
        save { token, id -> sheetsRepository.saveCreditCardsToSheets(token, id, updated) }
    }

    // ── Period overrides ──────────────────────────────────────────────────────

    fun updatePeriodOverride(periodStart: String, patch: (PayPeriodOverride) -> PayPeriodOverride) {
        val current = _uiState.value.periodOverrides
        val existing = current[periodStart] ?: emptyOverride()
        val updated = current + (periodStart to patch(existing))
        _uiState.update { it.copy(periodOverrides = updated) }
        save { token, id -> sheetsRepository.savePeriodOverridesToSheets(token, id, updated) }
    }

    fun setBillPaymentStatus(periodStart: String, key: String, status: BillPaymentStatus?) {
        updatePeriodOverride(periodStart) { override ->
            val statuses = override.billPaymentStatuses.toMutableMap()
            if (status == null) statuses.remove(key) else statuses[key] = status
            override.copy(billPaymentStatuses = statuses)
        }
    }

    fun setBillAmountOverride(periodStart: String, key: String, amountCents: Int?) {
        updatePeriodOverride(periodStart) { override ->
            val overrides = (override.billAmountOverrides ?: emptyMap()).toMutableMap()
            if (amountCents == null) overrides.remove(key) else overrides[key] = amountCents
            override.copy(billAmountOverrides = overrides)
        }
    }

    fun setPaycheckOverride(periodStart: String, amountCents: Int?) {
        updatePeriodOverride(periodStart) { it.copy(paycheckAmountCents = amountCents) }
    }

    fun addOneTimeBill(periodStart: String, name: String, amountCents: Int, dueDate: String) {
        updatePeriodOverride(periodStart) { override ->
            val newBill = OneTimeBill(
                id = UUID.randomUUID().toString(),
                name = name,
                amountCents = amountCents,
                dueDate = dueDate
            )
            override.copy(oneTimeBills = override.oneTimeBills + newBill)
        }
    }

    fun removeOneTimeBill(periodStart: String, billId: String) {
        updatePeriodOverride(periodStart) { override ->
            override.copy(oneTimeBills = override.oneTimeBills.filter { it.id != billId })
        }
    }

    fun moveBillOut(periodStart: String, billId: Int) {
        updatePeriodOverride(periodStart) { override ->
            override.copy(movedOutBillIds = override.movedOutBillIds + billId)
        }
    }

    fun moveBillIn(
        fromPeriodStart: String,
        toPeriodStart: String,
        billId: Int,
        toDueDate: String
    ) {
        // Remove from source period
        updatePeriodOverride(fromPeriodStart) { override ->
            override.copy(movedOutBillIds = override.movedOutBillIds + billId)
        }
        // Add to target period
        updatePeriodOverride(toPeriodStart) { override ->
            val moved = MovedInBill(billId = billId, fromPeriodStart = fromPeriodStart, dueDate = toDueDate)
            override.copy(movedInBills = override.movedInBills + moved)
        }
    }

    fun setCreditCardPaymentStatus(periodStart: String, cardId: String, status: BillPaymentStatus?) {
        updatePeriodOverride(periodStart) { override ->
            val statuses = (override.creditCardPaymentStatuses ?: emptyMap()).toMutableMap()
            if (status == null) statuses.remove(cardId) else statuses[cardId] = status
            override.copy(creditCardPaymentStatuses = statuses)
        }
    }

    fun setCreditCardPayments(periodStart: String, payments: List<CreditCardPayment>) {
        updatePeriodOverride(periodStart) { it.copy(creditCardPayments = payments) }
    }

    fun archivePeriod(periodStart: String) {
        updatePeriodOverride(periodStart) { it.copy(archived = true) }
    }

    fun unarchivePeriod(periodStart: String) {
        updatePeriodOverride(periodStart) { it.copy(archived = false) }
    }

    // ── Backup / Restore ──────────────────────────────────────────────────────

    fun restoreFromBackup(bills: List<Bill>, settings: PaySettings?) {
        _uiState.update { it.copy(bills = bills, settings = settings) }
        save { token, id ->
            sheetsRepository.saveBillsToSheets(token, id, bills)
            if (settings != null) sheetsRepository.saveSettingsToSheets(token, id, settings)
        }
    }

    fun clearSaveError() {
        _uiState.update { it.copy(saveError = null) }
    }

    fun clearLoadError() {
        _uiState.update { it.copy(loadError = null) }
    }

    override fun onCleared() {
        super.onCleared()
        authManager.removeAuthStateListener { }
    }
}
