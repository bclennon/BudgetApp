package com.example.budgetapp.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.example.budgetapp.domain.*
import com.example.budgetapp.ui.AppViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArchivedPeriodsScreen(viewModel: AppViewModel, navController: NavController) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Archived Pay Periods") },
                navigationIcon = { BackButton(navController) }
            )
        }
    ) { padding ->
        val settings = uiState.settings
        if (settings == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text(
                    "No settings configured yet.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            return@Scaffold
        }

        val archivedPeriods = remember(settings, uiState.bills, uiState.periodOverrides) {
            val startDates = uiState.periodOverrides
                .filter { it.value.archived }
                .keys
                .toList()
            if (startDates.isEmpty()) return@remember emptyList()
            val earliest = startDates.min()
            val startSettings = settings.copy(nextPayday = earliest)
            generatePayPeriods(startSettings, uiState.bills, 200, uiState.periodOverrides)
                .filter { uiState.periodOverrides[it.startDate]?.archived == true }
        }

        if (archivedPeriods.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("No archived pay periods yet.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Use the Archive button on a past pay period to move it here.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall)
                }
            }
            return@Scaffold
        }

        val periodsWithCards = rememberAdjustedCards(
            archivedPeriods, uiState.creditCards, uiState.periodOverrides, settings
        )

        LazyColumn(
            modifier = Modifier.padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(periodsWithCards, key = { it.first.startDate }) { (period, adjustedCards) ->
                ArchivedPeriodCard(
                    period = period,
                    adjustedCards = adjustedCards,
                    override = uiState.periodOverrides[period.startDate] ?: emptyOverride(),
                    defaultPaycheckCents = settings.paycheckAmountCents,
                    today = todayDateString(),
                    minSpendPerDayCents = settings.minSpendPerDayCents,
                    onSetBillStatus = { key, status ->
                        viewModel.setBillPaymentStatus(period.startDate, key, status)
                    },
                    onSetBillAmountOverride = { key, amount ->
                        viewModel.setBillAmountOverride(period.startDate, key, amount)
                    },
                    onSetPaycheckOverride = { amount ->
                        viewModel.setPaycheckOverride(period.startDate, amount)
                    },
                    onAddOneTimeBill = { name, amountCents, dueDate ->
                        viewModel.addOneTimeBill(period.startDate, name, amountCents, dueDate)
                    },
                    onRemoveOneTimeBill = { billId ->
                        viewModel.removeOneTimeBill(period.startDate, billId)
                    },
                    onSetCreditCardPaymentStatus = { cardId, status ->
                        viewModel.setCreditCardPaymentStatus(period.startDate, cardId, status)
                    },
                    onUnarchive = { viewModel.unarchivePeriod(period.startDate) }
                )
            }
        }
    }
}

@Composable
private fun ArchivedPeriodCard(
    period: PayPeriod,
    adjustedCards: List<CreditCard>,
    override: PayPeriodOverride,
    defaultPaycheckCents: Int,
    today: String,
    minSpendPerDayCents: Int,
    onSetBillStatus: (key: String, status: BillPaymentStatus?) -> Unit,
    onSetBillAmountOverride: (key: String, amountCents: Int?) -> Unit,
    onSetPaycheckOverride: (amountCents: Int?) -> Unit,
    onAddOneTimeBill: (name: String, amountCents: Int, dueDate: String) -> Unit,
    onRemoveOneTimeBill: (billId: String) -> Unit,
    onSetCreditCardPaymentStatus: (cardId: String, status: BillPaymentStatus?) -> Unit,
    onUnarchive: () -> Unit
) {
    var showUnarchiveConfirm by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        // Re-use the PeriodCard composable, but add an Unarchive button at the bottom via a wrapper
        Column {
            PeriodCard(
                period = period,
                adjustedCards = adjustedCards,
                override = override,
                defaultPaycheckCents = defaultPaycheckCents,
                today = today,
                minSpendPerDayCents = minSpendPerDayCents,
                onSetBillStatus = onSetBillStatus,
                onSetBillAmountOverride = onSetBillAmountOverride,
                onSetPaycheckOverride = onSetPaycheckOverride,
                onAddOneTimeBill = onAddOneTimeBill,
                onRemoveOneTimeBill = onRemoveOneTimeBill,
                onSetCreditCardPaymentStatus = onSetCreditCardPaymentStatus,
                onArchive = {} // Already archived — no-op
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.End
            ) {
                OutlinedButton(onClick = { showUnarchiveConfirm = true }) {
                    Text("📤 Unarchive")
                }
            }
        }
    }

    if (showUnarchiveConfirm) {
        AlertDialog(
            onDismissRequest = { showUnarchiveConfirm = false },
            title = { Text("Unarchive Period") },
            text = { Text("Move this period back to Pay Periods?") },
            confirmButton = {
                TextButton(onClick = {
                    onUnarchive()
                    showUnarchiveConfirm = false
                }) { Text("Unarchive") }
            },
            dismissButton = {
                TextButton(onClick = { showUnarchiveConfirm = false }) { Text("Cancel") }
            }
        )
    }
}
