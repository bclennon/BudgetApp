package com.example.budgetapp.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.example.budgetapp.domain.*
import com.example.budgetapp.ui.Screen
import com.example.budgetapp.ui.AppViewModel
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PayPeriodsScreen(viewModel: AppViewModel, navController: NavController) {
    val uiState by viewModel.uiState.collectAsState()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            AppDrawer(
                navController = navController,
                onClose = { scope.launch { drawerState.close() } }
            )
        }
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("Pay Periods") },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Default.Menu, contentDescription = "Menu")
                        }
                    }
                )
            }
        ) { padding ->
            when {
                uiState.isLoading -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                uiState.loadError != null -> {
                    Box(Modifier.fillMaxSize().padding(padding).padding(16.dp),
                        contentAlignment = Alignment.Center) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                uiState.loadError ?: "Unknown error",
                                color = MaterialTheme.colorScheme.error
                            )
                            Button(onClick = { viewModel.reload() }) { Text("Retry") }
                        }
                    }
                }
                uiState.settings == null -> {
                    Box(Modifier.fillMaxSize().padding(padding).padding(16.dp),
                        contentAlignment = Alignment.Center) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("No settings configured yet.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("Go to Settings to enter your paycheck details.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Button(onClick = { navController.navigate(Screen.Settings.route) }) {
                                Text("Go to Settings")
                            }
                        }
                    }
                }
                else -> {
                    val settings = uiState.settings!!
                    val today = todayDateString()
                    val periods = remember(settings, uiState.bills, uiState.periodOverrides) {
                        generatePayPeriods(settings, uiState.bills, 24, uiState.periodOverrides)
                            .filter { uiState.periodOverrides[it.startDate]?.archived != true }
                    }
                    val periodsWithCards = rememberAdjustedCards(
                        periods, uiState.creditCards, uiState.periodOverrides, settings
                    )

                    LazyColumn(
                        modifier = Modifier.padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(periodsWithCards, key = { it.first.startDate }) { (period, adjustedCards) ->
                            PeriodCard(
                                period = period,
                                adjustedCards = adjustedCards,
                                override = uiState.periodOverrides[period.startDate] ?: emptyOverride(),
                                defaultPaycheckCents = settings.paycheckAmountCents,
                                today = today,
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
                                onArchive = { viewModel.archivePeriod(period.startDate) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PeriodCard(
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
    onArchive: () -> Unit
) {
    var expanded by remember(period.startDate) { mutableStateOf(false) }
    val isCurrent = today >= period.startDate && today <= period.endDate
    val isPast = today > period.endDate
    val cardColor = when {
        isCurrent -> MaterialTheme.colorScheme.primaryContainer
        isPast -> MaterialTheme.colorScheme.surfaceVariant
        else -> MaterialTheme.colorScheme.surface
    }

    val plannedPayments = remember(period, adjustedCards) {
        val available = if (period.hasSurplus) period.surplusCents else 0
        getPlannedCardPayments(available, adjustedCards)
    }

    var showAddOneTimeBill by remember { mutableStateOf(false) }
    var showArchiveConfirm by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = cardColor)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header row
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "${formatDate(period.startDate)} – ${formatDate(period.endDate)}",
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "${period.daysInPeriod} days",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (isCurrent) {
                        Text(
                            "Current period",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
                // Summary
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        formatCents(period.displayedSpendingPerDay) + "/day",
                        fontWeight = FontWeight.Bold,
                        color = if (period.remainingCents < 0)
                            MaterialTheme.colorScheme.error
                        else MaterialTheme.colorScheme.primary
                    )
                    Text(
                        "${formatCents(period.remainingCents)} left",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                IconButton(onClick = { expanded = !expanded }) {
                    Icon(
                        if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                        contentDescription = if (expanded) "Collapse" else "Expand"
                    )
                }
            }

            AnimatedVisibility(visible = expanded) {
                Column(
                    modifier = Modifier.padding(top = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    HorizontalDivider()

                    // Paycheck
                    PaycheckRow(
                        currentCents = period.paycheckAmountCents,
                        isOverridden = override.paycheckAmountCents != null,
                        defaultCents = defaultPaycheckCents,
                        onSetOverride = onSetPaycheckOverride
                    )

                    // Bills
                    if (period.bills.isNotEmpty()) {
                        Text("Bills", fontWeight = FontWeight.Medium)
                        period.bills.forEach { bip ->
                            BillRow(
                                bip = bip,
                                override = override,
                                onSetStatus = onSetBillStatus,
                                onSetAmountOverride = onSetBillAmountOverride,
                                onRemoveOneTime = onRemoveOneTimeBill
                            )
                        }
                    }

                    // Credit card payments
                    if (plannedPayments.isNotEmpty()) {
                        Text("Credit Card Payments", fontWeight = FontWeight.Medium)
                        plannedPayments.forEach { (card, amount) ->
                            val ccStatuses = override.creditCardPaymentStatuses
                            val status = ccStatuses?.get(card.id)
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        "→ ${card.name}",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = if (status == BillPaymentStatus.PROCESSED)
                                            MaterialTheme.colorScheme.onSurfaceVariant
                                        else MaterialTheme.colorScheme.onSurface,
                                        textDecoration = if (status == BillPaymentStatus.PROCESSED)
                                            androidx.compose.ui.text.style.TextDecoration.LineThrough
                                        else null
                                    )
                                    Text(
                                        "-${formatCents(amount)}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                StatusChip(
                                    status = status,
                                    onSetStatus = { newStatus ->
                                        onSetCreditCardPaymentStatus(card.id, newStatus)
                                    }
                                )
                            }
                        }
                    }

                    HorizontalDivider()

                    // Totals
                    Row(modifier = Modifier.fillMaxWidth()) {
                        Text("Bills total", modifier = Modifier.weight(1f))
                        Text("-${formatCents(period.billsTotalCents)}")
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Remaining", fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        Text(
                            formatCents(period.remainingCents),
                            fontWeight = FontWeight.Bold,
                            color = if (period.remainingCents < 0)
                                MaterialTheme.colorScheme.error
                            else MaterialTheme.colorScheme.tertiary
                        )
                    }
                    if (period.hasSurplus) {
                        Row(modifier = Modifier.fillMaxWidth()) {
                            Text("Surplus for CC payments", modifier = Modifier.weight(1f))
                            Text(formatCents(period.surplusCents))
                        }
                    }
                    Row(modifier = Modifier.fillMaxWidth()) {
                        Text("Spending / day", fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                        Text(
                            formatCents(period.displayedSpendingPerDay),
                            fontWeight = FontWeight.Medium
                        )
                    }

                    HorizontalDivider()

                    // Actions
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { showAddOneTimeBill = true },
                            modifier = Modifier.weight(1f)
                        ) { Text("+ One-time Bill") }
                        if (isPast || isCurrent) {
                            OutlinedButton(
                                onClick = { showArchiveConfirm = true },
                                modifier = Modifier.weight(1f)
                            ) { Text("Archive") }
                        }
                    }
                }
            }
        }
    }

    if (showAddOneTimeBill) {
        AddOneTimeBillDialog(
            periodStart = period.startDate,
            periodEnd = period.endDate,
            onConfirm = { name, amountCents, dueDate ->
                onAddOneTimeBill(name, amountCents, dueDate)
                showAddOneTimeBill = false
            },
            onDismiss = { showAddOneTimeBill = false }
        )
    }

    if (showArchiveConfirm) {
        AlertDialog(
            onDismissRequest = { showArchiveConfirm = false },
            title = { Text("Archive Period") },
            text = { Text("Archive this pay period? It will be moved to Archived Periods.") },
            confirmButton = {
                TextButton(onClick = {
                    onArchive()
                    showArchiveConfirm = false
                }) { Text("Archive") }
            },
            dismissButton = {
                TextButton(onClick = { showArchiveConfirm = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun PaycheckRow(
    currentCents: Int,
    isOverridden: Boolean,
    defaultCents: Int,
    onSetOverride: (Int?) -> Unit
) {
    var editing by remember { mutableStateOf(false) }
    var editValue by remember { mutableStateOf("") }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "Paycheck: ${formatCents(currentCents)}" +
                        if (isOverridden) " (overridden)" else "",
                fontWeight = FontWeight.Medium
            )
        }
        TextButton(onClick = {
            editValue = dollarsToStr(currentCents)
            editing = true
        }) { Text("Edit") }
    }

    if (editing) {
        AlertDialog(
            onDismissRequest = { editing = false },
            title = { Text("Override Paycheck") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = editValue,
                        onValueChange = { editValue = it },
                        label = { Text("Amount ($)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true
                    )
                    if (isOverridden) {
                        Text(
                            "Default: ${formatCents(defaultCents)}",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            },
            confirmButton = {
                Row {
                    if (isOverridden) {
                        TextButton(onClick = {
                            onSetOverride(null)
                            editing = false
                        }) { Text("Reset") }
                    }
                    TextButton(onClick = {
                        val cents = strToCents(editValue)
                        if (cents != null && cents > 0) {
                            onSetOverride(cents)
                            editing = false
                        }
                    }) { Text("Save") }
                }
            },
            dismissButton = { TextButton(onClick = { editing = false }) { Text("Cancel") } }
        )
    }
}

@Composable
private fun BillRow(
    bip: BillInPeriod,
    override: PayPeriodOverride,
    onSetStatus: (key: String, status: BillPaymentStatus?) -> Unit,
    onSetAmountOverride: (key: String, amountCents: Int?) -> Unit,
    onRemoveOneTime: (billId: String) -> Unit
) {
    val key = if (bip.isOneTime) bip.oneTimeBillId!! else bip.bill.id.toString()
    val status = override.billPaymentStatuses[key]
    val effectiveAmount = bip.amountOverrideCents ?: bip.bill.amountCents

    var editingAmount by remember { mutableStateOf(false) }
    var amountValue by remember { mutableStateOf("") }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                buildString {
                    append(bip.bill.name)
                    if (bip.isOneTime) append(" ✦")
                    if (bip.movedFromPeriod != null) append(" ↔")
                },
                textDecoration = if (status == BillPaymentStatus.PROCESSED)
                    androidx.compose.ui.text.style.TextDecoration.LineThrough else null,
                color = if (status == BillPaymentStatus.PROCESSED)
                    MaterialTheme.colorScheme.onSurfaceVariant
                else MaterialTheme.colorScheme.onSurface
            )
            Text(
                "Due ${formatDate(bip.dueDate)} · ${formatCents(effectiveAmount)}" +
                        if (bip.amountOverrideCents != null) " (overridden)" else "",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        if (!bip.isOneTime) {
            IconButton(onClick = {
                amountValue = dollarsToStr(effectiveAmount)
                editingAmount = true
            }) {
                Text("$", style = MaterialTheme.typography.labelSmall)
            }
        }

        if (bip.isOneTime) {
            IconButton(onClick = { onRemoveOneTime(bip.oneTimeBillId!!) }) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "Remove",
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }

        StatusChip(status = status, onSetStatus = { newStatus ->
            onSetStatus(key, newStatus)
        })
    }

    if (editingAmount) {
        AlertDialog(
            onDismissRequest = { editingAmount = false },
            title = { Text("Override Amount") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = amountValue,
                        onValueChange = { amountValue = it },
                        label = { Text("Amount ($)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true
                    )
                    Text(
                        "Original: ${formatCents(bip.bill.amountCents)}",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            },
            confirmButton = {
                Row {
                    if (bip.amountOverrideCents != null) {
                        TextButton(onClick = {
                            onSetAmountOverride(key, null)
                            editingAmount = false
                        }) { Text("Reset") }
                    }
                    TextButton(onClick = {
                        val cents = strToCents(amountValue)
                        if (cents != null && cents > 0) {
                            onSetAmountOverride(key, cents)
                            editingAmount = false
                        }
                    }) { Text("Save") }
                }
            },
            dismissButton = { TextButton(onClick = { editingAmount = false }) { Text("Cancel") } }
        )
    }
}

@Composable
private fun StatusChip(
    status: BillPaymentStatus?,
    onSetStatus: (BillPaymentStatus?) -> Unit
) {
    val (label, color) = when (status) {
        BillPaymentStatus.PROCESSED -> "Processed" to MaterialTheme.colorScheme.tertiary
        BillPaymentStatus.SUBMITTED -> "Submitted" to MaterialTheme.colorScheme.secondary
        null -> "Unpaid" to MaterialTheme.colorScheme.onSurfaceVariant
    }
    TextButton(
        onClick = {
            val next = when (status) {
                null -> BillPaymentStatus.SUBMITTED
                BillPaymentStatus.SUBMITTED -> BillPaymentStatus.PROCESSED
                BillPaymentStatus.PROCESSED -> null
            }
            onSetStatus(next)
        }
    ) {
        Text(label, color = color, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun AddOneTimeBillDialog(
    periodStart: String,
    periodEnd: String,
    onConfirm: (name: String, amountCents: Int, dueDate: String) -> Unit,
    onDismiss: () -> Unit
) {
    var name by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var dueDate by remember { mutableStateOf(periodStart) }
    var error by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add One-Time Bill") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (error.isNotEmpty()) {
                    Text(error, color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall)
                }
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it },
                    label = { Text("Amount ($)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = dueDate,
                    onValueChange = { dueDate = it },
                    label = { Text("Due Date (YYYY-MM-DD)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Text(
                    "Period: $periodStart – $periodEnd",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val cents = strToCents(amount)
                when {
                    name.isBlank() -> error = "Name is required."
                    cents == null || cents <= 0 -> error = "Enter a valid amount."
                    !dueDate.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) ->
                        error = "Due date must be YYYY-MM-DD."
                    dueDate < periodStart || dueDate > periodEnd ->
                        error = "Due date must be within this pay period."
                    else -> onConfirm(name.trim(), cents, dueDate)
                }
            }) { Text("Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

// ── Shared nav drawer ─────────────────────────────────────────────────────────

@Composable
fun AppDrawer(navController: NavController, onClose: () -> Unit) {
    ModalDrawerSheet {
        Spacer(Modifier.height(16.dp))
        Text(
            "Budget App",
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
        )
        HorizontalDivider()
        listOf(
            "💵" to "Pay Periods" to Screen.PayPeriods.route,
            "📋" to "Bills" to Screen.Bills.route,
            "💳" to "Credit Cards" to Screen.CreditCards.route,
            "⚙️" to "Settings" to Screen.Settings.route,
            "📦" to "Archived Periods" to Screen.ArchivedPeriods.route,
            "💾" to "Backup & Sync" to Screen.BackupSync.route
        ).forEach { (iconLabel, route) ->
            val (icon, label) = iconLabel
            NavigationDrawerItem(
                icon = { Text(icon) },
                label = { Text(label) },
                selected = false,
                onClick = {
                    navController.navigate(route) {
                        popUpTo(Screen.PayPeriods.route) { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                    onClose()
                },
                modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding)
            )
        }
    }
}

// ── Shared back button ────────────────────────────────────────────────────────

@Composable
fun BackButton(navController: NavController) {
    IconButton(onClick = { navController.popBackStack() }) {
        Icon(
            Icons.AutoMirrored.Filled.ArrowBack,
            contentDescription = "Back"
        )
    }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

private val MONTH_NAMES = arrayOf(
    "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"
)

internal fun formatDate(dateStr: String): String {
    val parts = dateStr.split("-")
    if (parts.size != 3) return dateStr
    val m = parts[1].toIntOrNull()?.minus(1) ?: return dateStr
    val d = parts[2].toIntOrNull() ?: return dateStr
    val y = parts[0]
    return "${MONTH_NAMES.getOrElse(m) { parts[1] }} $d, $y"
}

internal fun todayDateString(): String {
    val cal = Calendar.getInstance()
    return "%04d-%02d-%02d".format(
        cal.get(Calendar.YEAR),
        cal.get(Calendar.MONTH) + 1,
        cal.get(Calendar.DAY_OF_MONTH)
    )
}

// ── Credit-card running balance computation ───────────────────────────────────

@Composable
internal fun rememberAdjustedCards(
    periods: List<PayPeriod>,
    creditCards: List<CreditCard>,
    overrides: PeriodOverrides,
    settings: PaySettings
): List<Pair<PayPeriod, List<CreditCard>>> {
    return remember(periods, creditCards, overrides) {
        val result = mutableListOf<Pair<PayPeriod, List<CreditCard>>>()
        var runningCards = creditCards

        for (period in periods) {
            val adjustedCards = runningCards
            val override = overrides[period.startDate]
            val ccStatuses = override?.creditCardPaymentStatuses
            val legacyCcProcessed = ccStatuses == null && override?.creditCardPaymentStatus == BillPaymentStatus.PROCESSED

            if (!legacyCcProcessed) {
                val available = if (period.hasSurplus) period.surplusCents else 0
                val payments = getPlannedCardPayments(available, adjustedCards)
                if (payments.isNotEmpty()) {
                    val paymentMap = payments.associate { (card, amt) -> card.id to amt }
                    runningCards = runningCards.map { c ->
                        val planned = paymentMap[c.id]
                        if (planned == null) c
                        else if (ccStatuses?.get(c.id) == BillPaymentStatus.PROCESSED) c
                        else c.copy(balanceCents = maxOf(0, c.balanceCents - planned))
                    }
                }
            }
            result.add(period to adjustedCards)
        }
        result
    }
}

