package com.example.budgetapp.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.example.budgetapp.domain.Frequency
import com.example.budgetapp.domain.PaySettings
import com.example.budgetapp.ui.AppViewModel

private val FREQUENCY_LABELS = mapOf(
    Frequency.WEEKLY to "Weekly",
    Frequency.BIWEEKLY to "Bi-weekly",
    Frequency.SEMI_MONTHLY to "Semi-monthly (15th & 30th)",
    Frequency.MONTHLY to "Monthly"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: AppViewModel, navController: NavController) {
    val uiState by viewModel.uiState.collectAsState()
    val settings = uiState.settings

    var paycheck by remember(settings) {
        mutableStateOf(if (settings != null) dollarsToStr(settings.paycheckAmountCents) else "")
    }
    var frequency by remember(settings) {
        mutableStateOf(settings?.frequency ?: Frequency.BIWEEKLY)
    }
    var nextPayday by remember(settings) {
        mutableStateOf(settings?.nextPayday ?: "")
    }
    var minSpendPerDay by remember(settings) {
        mutableStateOf(if (settings != null) dollarsToStr(settings.minSpendPerDayCents) else "0.00")
    }
    var error by remember { mutableStateOf("") }
    var saved by remember { mutableStateOf(false) }

    var frequencyExpanded by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = { BackButton(navController) }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Card {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Pay Settings", style = MaterialTheme.typography.titleMedium)

                    if (error.isNotEmpty()) {
                        Text(error, color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall)
                    }
                    if (saved) {
                        Text("Settings saved!", color = MaterialTheme.colorScheme.tertiary,
                            style = MaterialTheme.typography.bodySmall)
                    }

                    OutlinedTextField(
                        value = paycheck,
                        onValueChange = { paycheck = it },
                        label = { Text("Paycheck Amount ($)") },
                        placeholder = { Text("0.00") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    // Frequency dropdown
                    ExposedDropdownMenuBox(
                        expanded = frequencyExpanded,
                        onExpandedChange = { frequencyExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = FREQUENCY_LABELS[frequency] ?: frequency.name,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Pay Frequency") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = frequencyExpanded) },
                            modifier = Modifier
                                .menuAnchor()
                                .fillMaxWidth()
                        )
                        ExposedDropdownMenu(
                            expanded = frequencyExpanded,
                            onDismissRequest = { frequencyExpanded = false }
                        ) {
                            Frequency.entries.forEach { freq ->
                                DropdownMenuItem(
                                    text = { Text(FREQUENCY_LABELS[freq] ?: freq.name) },
                                    onClick = {
                                        frequency = freq
                                        frequencyExpanded = false
                                    }
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = nextPayday,
                        onValueChange = { nextPayday = it },
                        label = { Text("Next Payday (YYYY-MM-DD)") },
                        placeholder = { Text("2025-01-01") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = minSpendPerDay,
                        onValueChange = { minSpendPerDay = it },
                        label = { Text("Min. Spending / Day ($)") },
                        placeholder = { Text("0.00") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Text(
                        "Amount reserved for daily spending. Surplus above this goes toward credit card payments.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Button(
                        onClick = {
                            error = ""
                            val paycheckCents = strToCents(paycheck)
                            val minSpendCents = strToCents(minSpendPerDay) ?: 0
                            when {
                                paycheckCents == null || paycheckCents <= 0 ->
                                    error = "Enter a valid paycheck amount."
                                nextPayday.isBlank() ->
                                    error = "Enter a next payday date."
                                !nextPayday.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) ->
                                    error = "Next payday must be in YYYY-MM-DD format."
                                minSpendCents < 0 ->
                                    error = "Enter a valid minimum spending amount."
                                else -> {
                                    viewModel.saveSettings(
                                        PaySettings(
                                            paycheckAmountCents = paycheckCents,
                                            frequency = frequency,
                                            nextPayday = nextPayday,
                                            minSpendPerDayCents = minSpendCents
                                        )
                                    )
                                    saved = true
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Save Settings")
                    }
                }
            }
        }
    }

    // Auto-hide "saved" banner after 2 seconds
    LaunchedEffect(saved) {
        if (saved) {
            kotlinx.coroutines.delay(2000)
            saved = false
        }
    }
}
