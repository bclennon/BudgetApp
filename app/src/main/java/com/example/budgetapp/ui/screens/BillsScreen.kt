package com.example.budgetapp.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.budgetapp.domain.model.Bill
import com.example.budgetapp.ui.viewmodel.BillsViewModel

@Composable
fun BillsScreen(viewModel: BillsViewModel = viewModel()) {
    val bills by viewModel.bills.collectAsStateWithLifecycle()
    var showAddDialog by remember { mutableStateOf(false) }
    var editingBill by remember { mutableStateOf<Bill?>(null) }

    Box(modifier = Modifier.fillMaxSize()) {
        if (bills.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No bills yet. Tap + to add one.")
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 80.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(bills, key = { it.id }) { bill ->
                    BillCard(
                        bill = bill,
                        onEdit = { editingBill = bill },
                        onDelete = { viewModel.deleteBill(bill) }
                    )
                }
            }
        }
        FloatingActionButton(
            onClick = { showAddDialog = true },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp)
        ) {
            Icon(Icons.Default.Add, contentDescription = "Add Bill")
        }
    }

    if (showAddDialog) {
        BillDialog(
            title = "Add Bill",
            onDismiss = { showAddDialog = false },
            onConfirm = { name, day, cents ->
                viewModel.addBill(name, day, cents)
                showAddDialog = false
            }
        )
    }

    editingBill?.let { bill ->
        BillDialog(
            title = "Edit Bill",
            initialName = bill.name,
            initialDay = bill.dayOfMonth.toString(),
            initialAmount = (bill.amountCents / 100.0).toString(),
            onDismiss = { editingBill = null },
            onConfirm = { name, day, cents ->
                viewModel.updateBill(bill.copy(name = name, dayOfMonth = day, amountCents = cents))
                editingBill = null
            }
        )
    }
}

@Composable
fun BillCard(bill: Bill, onEdit: () -> Unit, onDelete: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(bill.name, style = MaterialTheme.typography.titleMedium)
                Text("Due: day ${bill.dayOfMonth}", style = MaterialTheme.typography.bodySmall)
            }
            Text(formatCents(bill.amountCents), style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.width(8.dp))
            IconButton(onClick = onEdit) {
                Icon(Icons.Default.Edit, contentDescription = "Edit")
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Delete")
            }
        }
    }
}

@Composable
fun BillDialog(
    title: String,
    initialName: String = "",
    initialDay: String = "",
    initialAmount: String = "",
    onDismiss: () -> Unit,
    onConfirm: (String, Int, Long) -> Unit
) {
    var name by remember { mutableStateOf(initialName) }
    var day by remember { mutableStateOf(initialDay) }
    var amount by remember { mutableStateOf(initialAmount) }
    var error by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = day,
                    onValueChange = { day = it },
                    label = { Text("Day of Month (1-31)") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it },
                    label = { Text("Amount (\$)") },
                    singleLine = true
                )
                error?.let {
                    Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val d = day.toIntOrNull()
                val a = amount.toDoubleOrNull()
                when {
                    name.isBlank() -> error = "Name required"
                    d == null || d < 1 || d > 31 -> error = "Day must be 1-31"
                    a == null || a < 0 -> error = "Invalid amount"
                    else -> onConfirm(name.trim(), d, (a * 100).toLong())
                }
            }) { Text("Save") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
