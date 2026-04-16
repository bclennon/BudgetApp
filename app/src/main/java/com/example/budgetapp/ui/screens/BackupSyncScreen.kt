package com.example.budgetapp.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.budgetapp.ui.viewmodel.BackupSyncViewModel

@Composable
fun BackupSyncScreen(viewModel: BackupSyncViewModel = viewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showRestoreConfirm by remember { mutableStateOf(false) }

    val createDocumentLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("application/json")
    ) { uri: Uri? ->
        uri?.let { viewModel.setBackupUri(it) }
    }

    val openDocumentLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        uri?.let { viewModel.setBackupUri(it) }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Backup & Sync", style = MaterialTheme.typography.headlineSmall)

        OutlinedButton(
            onClick = { createDocumentLauncher.launch("budget_backup.json") },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Create Backup File")
        }

        OutlinedButton(
            onClick = { openDocumentLauncher.launch(arrayOf("application/json", "*/*")) },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Pick Existing Backup File")
        }

        uiState.backupUri?.let { uri ->
            Text(
                "Selected: $uri",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        uiState.lastSyncAt?.let { ts ->
            Text(
                "Last sync: $ts",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        HorizontalDivider()

        Button(
            onClick = { viewModel.syncToBackup() },
            modifier = Modifier.fillMaxWidth(),
            enabled = uiState.backupUri != null && !uiState.isLoading
        ) {
            Text("Sync to Backup")
        }

        OutlinedButton(
            onClick = { showRestoreConfirm = true },
            modifier = Modifier.fillMaxWidth(),
            enabled = uiState.backupUri != null && !uiState.isLoading
        ) {
            Text("Restore from Backup")
        }

        if (uiState.isLoading) {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        }

        uiState.statusMessage?.let { msg ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Text(
                    msg,
                    modifier = Modifier.padding(12.dp),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }

    if (showRestoreConfirm) {
        AlertDialog(
            onDismissRequest = { showRestoreConfirm = false },
            title = { Text("Restore from Backup?") },
            text = { Text("This will replace all current data with the backup. This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.restoreFromBackup()
                    showRestoreConfirm = false
                }) { Text("Restore") }
            },
            dismissButton = {
                TextButton(onClick = { showRestoreConfirm = false }) { Text("Cancel") }
            }
        )
    }
}
