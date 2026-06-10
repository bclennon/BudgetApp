package com.example.budgetapp.ui.screens

import android.content.Context
import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.example.budgetapp.domain.BackupData
import com.example.budgetapp.domain.Bill
import com.example.budgetapp.domain.PaySettings
import com.example.budgetapp.ui.AppViewModel
import com.google.gson.Gson

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BackupSyncScreen(viewModel: AppViewModel, navController: NavController) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val gson = remember { Gson() }

    var statusMessage by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf("") }
    var showRestoreConfirm by remember { mutableStateOf<BackupData?>(null) }

    // File picker for restore
    val restoreLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        try {
            val text = context.contentResolver.openInputStream(uri)?.use { it.reader().readText() }
                ?: throw Exception("Could not read file.")
            val data = gson.fromJson(text, BackupData::class.java)
            if (data.schemaVersion != 1) {
                errorMessage = "Unsupported backup version."
                statusMessage = ""
            } else {
                showRestoreConfirm = data
            }
        } catch (e: Exception) {
            errorMessage = "Failed to parse backup file: ${e.message}"
            statusMessage = ""
        }
    }

    // File writer for export
    val exportLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        try {
            val data = BackupData(
                schemaVersion = 1,
                exportedAt = java.time.Instant.now().toString(),
                settings = uiState.settings,
                bills = uiState.bills
            )
            context.contentResolver.openOutputStream(uri)?.use { out ->
                out.write(gson.toJson(data).toByteArray())
            }
            statusMessage = "Backup downloaded."
            errorMessage = ""
        } catch (e: Exception) {
            errorMessage = "Export failed: ${e.message}"
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Backup & Sync") },
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
            if (statusMessage.isNotEmpty()) {
                Text(statusMessage, color = MaterialTheme.colorScheme.tertiary)
            }
            if (errorMessage.isNotEmpty()) {
                Text(errorMessage, color = MaterialTheme.colorScheme.error)
            }

            // Export backup
            Card {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Export Backup", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Download your bills and settings as a budget_backup.json file.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Button(
                        onClick = { exportLauncher.launch("budget_backup.json") },
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("💾 Download Backup") }
                }
            }

            // Restore from backup
            Card {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Restore from Backup", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Select a previously exported budget_backup.json file to restore your data. This will replace all current data.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    OutlinedButton(
                        onClick = { restoreLauncher.launch(arrayOf("application/json")) },
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("📂 Choose Backup File") }
                }
            }

            // Current data summary
            Card {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Current Data", style = MaterialTheme.typography.titleMedium)
                    val billCount = uiState.bills.size
                    Text("${billCount} bill${if (billCount != 1) "s" else ""}")
                    Text(if (uiState.settings != null) "Settings configured" else "No settings configured")
                    uiState.spreadsheetId?.let { id ->
                        Text(
                            "Spreadsheet ID: $id",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // Sign out
            Card {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Account", style = MaterialTheme.typography.titleMedium)
                    OutlinedButton(
                        onClick = { viewModel.signOut() },
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("Sign Out") }
                }
            }
        }
    }

    showRestoreConfirm?.let { backupData ->
        AlertDialog(
            onDismissRequest = { showRestoreConfirm = null },
            title = { Text("Restore Backup") },
            text = {
                Text(
                    "This will replace all current data with ${backupData.bills.size} bills " +
                            "from the backup. Continue?"
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.restoreFromBackup(backupData.bills, backupData.settings)
                    statusMessage = "Data restored successfully."
                    errorMessage = ""
                    showRestoreConfirm = null
                }) { Text("Restore") }
            },
            dismissButton = {
                TextButton(onClick = { showRestoreConfirm = null }) { Text("Cancel") }
            }
        )
    }
}
