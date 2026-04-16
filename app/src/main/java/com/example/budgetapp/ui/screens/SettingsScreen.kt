package com.example.budgetapp.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.budgetapp.domain.model.Frequency
import com.example.budgetapp.domain.model.PaySettings
import com.example.budgetapp.ui.viewmodel.SettingsViewModel
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: SettingsViewModel = viewModel()) {
    val settings by viewModel.settings.collectAsStateWithLifecycle()

    var paycheckAmount by remember { mutableStateOf("") }
    var frequency by remember { mutableStateOf(Frequency.BIWEEKLY) }
    var nextPayday by remember { mutableStateOf("") }
    var targetSpending by remember { mutableStateOf("") }
    var frequencyExpanded by remember { mutableStateOf(false) }
    var statusMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(settings) {
        settings?.let { s ->
            paycheckAmount = (s.paycheckAmountCents / 100.0).toString()
            frequency = s.frequency
            nextPayday = s.nextPayday.toString()
            targetSpending = (s.targetSpendingPerDayCents / 100.0).toString()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Pay Settings", style = MaterialTheme.typography.headlineSmall)

        OutlinedTextField(
            value = paycheckAmount,
            onValueChange = { paycheckAmount = it },
            label = { Text("Paycheck Amount (\$)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        ExposedDropdownMenuBox(
            expanded = frequencyExpanded,
            onExpandedChange = { frequencyExpanded = it }
        ) {
            OutlinedTextField(
                value = frequency.name.replace('_', ' '),
                onValueChange = {},
                readOnly = true,
                label = { Text("Frequency") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = frequencyExpanded) },
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor()
            )
            ExposedDropdownMenu(
                expanded = frequencyExpanded,
                onDismissRequest = { frequencyExpanded = false }
            ) {
                Frequency.entries.forEach { f ->
                    DropdownMenuItem(
                        text = { Text(f.name.replace('_', ' ')) },
                        onClick = { frequency = f; frequencyExpanded = false }
                    )
                }
            }
        }

        OutlinedTextField(
            value = nextPayday,
            onValueChange = { nextPayday = it },
            label = { Text("Next Payday (YYYY-MM-DD)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        OutlinedTextField(
            value = targetSpending,
            onValueChange = { targetSpending = it },
            label = { Text("Target Spending / Day (\$)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        statusMessage?.let {
            Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall)
        }

        Button(
            onClick = {
                val paycheck = paycheckAmount.toDoubleOrNull()
                val target = targetSpending.toDoubleOrNull()
                val payday = try { LocalDate.parse(nextPayday) } catch (e: Exception) { null }
                when {
                    paycheck == null || paycheck < 0 -> statusMessage = "Paycheck amount must be a positive number"
                    payday == null -> statusMessage = "Invalid date (use YYYY-MM-DD)"
                    target == null || target < 0 -> statusMessage = "Invalid target spending"
                    else -> {
                        viewModel.saveSettings(
                            PaySettings(
                                paycheckAmountCents = (paycheck * 100).toLong(),
                                frequency = frequency,
                                nextPayday = payday,
                                targetSpendingPerDayCents = (target * 100).toLong()
                            )
                        )
                        statusMessage = "Settings saved"
                    }
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Save Settings")
        }
    }
}
