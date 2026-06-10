package com.example.budgetapp.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.example.budgetapp.domain.Bill
import com.example.budgetapp.domain.ParsedBillRow
import com.example.budgetapp.domain.parseImportText
import com.example.budgetapp.ui.AppViewModel
import com.example.budgetapp.ui.Screen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BillsScreen(viewModel: AppViewModel, navController: NavController) {
    val uiState by viewModel.uiState.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }
    var editingBill by remember { mutableStateOf<Bill?>(null) }
    var showImport by remember { mutableStateOf(false) }
    var deleteCandidate by remember { mutableStateOf<Bill?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Bills") },
                navigationIcon = { BackButton(navController) },
                actions = {
                    IconButton(onClick = { showImport = true }) {
                        Icon(Icons.Default.Add, contentDescription = "Import")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add bill")
            }
        }
    ) { padding ->
        if (uiState.bills.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("No bills added yet.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyColumn(
                modifier = Modifier.padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(uiState.bills, key = { it.id }) { bill ->
                    BillCard(
                        bill = bill,
                        onEdit = { editingBill = bill },
                        onDelete = { deleteCandidate = bill }
                    )
                }
            }
        }
    }

    if (showAddDialog) {
        BillFormDialog(
            title = "New Bill",
            onSave = { name, day, amount, url ->
                viewModel.addBill(name, day, amount, url)
                showAddDialog = false
            },
            onDismiss = { showAddDialog = false }
        )
    }

    editingBill?.let { bill ->
        BillFormDialog(
            title = "Edit Bill",
            initial = bill,
            onSave = { name, day, amount, url ->
                viewModel.updateBill(bill.copy(name = name, dayOfMonth = day, amountCents = amount, url = url.takeIf { it.isNotBlank() }))
                editingBill = null
            },
            onDismiss = { editingBill = null }
        )
    }

    deleteCandidate?.let { bill ->
        AlertDialog(
            onDismissRequest = { deleteCandidate = null },
            title = { Text("Delete Bill") },
            text = { Text("Delete \"${bill.name}\"?") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteBill(bill.id)
                    deleteCandidate = null
                }) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { deleteCandidate = null }) { Text("Cancel") }
            }
        )
    }

    if (showImport) {
        ImportBillsDialog(
            onConfirm = { rows ->
                viewModel.importBills(rows)
                showImport = false
            },
            onDismiss = { showImport = false }
        )
    }
}

@Composable
private fun BillCard(bill: Bill, onEdit: () -> Unit, onDelete: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(bill.name, fontWeight = FontWeight.Medium)
                Text(
                    "Due day ${bill.dayOfMonth} · ${formatCents(bill.amountCents)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            IconButton(onClick = onEdit) {
                Icon(Icons.Default.Edit, contentDescription = "Edit")
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Delete",
                    tint = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
private fun BillFormDialog(
    title: String,
    initial: Bill? = null,
    onSave: (name: String, dayOfMonth: Int, amountCents: Int, url: String) -> Unit,
    onDismiss: () -> Unit
) {
    var name by remember { mutableStateOf(initial?.name ?: "") }
    var day by remember { mutableStateOf(initial?.dayOfMonth?.toString() ?: "1") }
    var amount by remember { mutableStateOf(if (initial != null) dollarsToStr(initial.amountCents) else "") }
    var url by remember { mutableStateOf(initial?.url ?: "") }
    var error by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
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
                    placeholder = { Text("e.g. Rent") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = day,
                        onValueChange = { day = it },
                        label = { Text("Day (1–31)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = amount,
                        onValueChange = { amount = it },
                        label = { Text("Amount ($)") },
                        placeholder = { Text("0.00") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                OutlinedTextField(
                    value = url,
                    onValueChange = { url = it },
                    label = { Text("Payment URL (optional)") },
                    placeholder = { Text("https://example.com/pay") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val dayNum = day.toIntOrNull()
                val amountNum = amount.toDoubleOrNull()
                when {
                    name.isBlank() -> error = "Name is required."
                    dayNum == null || dayNum < 1 || dayNum > 31 -> error = "Day must be 1–31."
                    amountNum == null || amountNum <= 0 -> error = "Enter a valid amount."
                    url.isNotBlank() && !url.startsWith("http://") && !url.startsWith("https://") ->
                        error = "URL must start with http:// or https://."
                    else -> onSave(name.trim(), dayNum, (amountNum * 100).toLong().toInt(), url.trim())
                }
            }) { Text(if (initial != null) "Save" else "Add Bill") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun ImportBillsDialog(
    onConfirm: (List<ParsedBillRow>) -> Unit,
    onDismiss: () -> Unit
) {
    var text by remember { mutableStateOf("") }
    var rows by remember { mutableStateOf<List<ParsedBillRow>?>(null) }
    val validRows = rows?.filter { it.error == null } ?: emptyList()
    val errorRows = rows?.filter { it.error != null } ?: emptyList()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Import Bills") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (rows == null) {
                    Text(
                        "Paste tab-delimited text. Each line: name · day · amount",
                        style = MaterialTheme.typography.bodySmall
                    )
                    OutlinedTextField(
                        value = text,
                        onValueChange = { text = it },
                        modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp),
                        placeholder = { Text("Rent\t1\t1200\nNetflix\t15\t20") }
                    )
                } else {
                    if (errorRows.isNotEmpty()) {
                        Text(
                            "${errorRows.size} line(s) skipped: ${errorRows.joinToString(", ") { it.name }}",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    if (validRows.isNotEmpty()) {
                        Text("${validRows.size} bill(s) ready to import:")
                        validRows.forEach { row ->
                            Text("• ${row.name} — day ${row.dayOfMonth} — ${formatCents(row.amountCents)}",
                                style = MaterialTheme.typography.bodySmall)
                        }
                    } else {
                        Text("No valid bills found.", color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        },
        confirmButton = {
            if (rows == null) {
                TextButton(onClick = { rows = parseImportText(text) }, enabled = text.isNotBlank()) {
                    Text("Preview")
                }
            } else {
                TextButton(onClick = { onConfirm(validRows) }, enabled = validRows.isNotEmpty()) {
                    Text("Add ${validRows.size} Bill(s)")
                }
            }
        },
        dismissButton = {
            if (rows != null) {
                TextButton(onClick = { rows = null }) { Text("Back") }
            } else {
                TextButton(onClick = onDismiss) { Text("Cancel") }
            }
        }
    )
}

internal fun formatCents(cents: Int): String {
    val abs = kotlin.math.abs(cents)
    val dollars = abs / 100
    val remaining = abs % 100
    return (if (cents < 0) "-\$" else "\$") + "$dollars.%02d".format(remaining)
}

internal fun dollarsToStr(cents: Int): String {
    val dollars = cents / 100
    val remaining = cents % 100
    return "$dollars.%02d".format(remaining)
}

internal fun strToCents(value: String): Int? {
    val d = value.toDoubleOrNull() ?: return null
    return (d * 100).toLong().toInt()
}
