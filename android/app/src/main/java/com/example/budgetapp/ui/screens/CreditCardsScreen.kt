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
import com.example.budgetapp.domain.CreditCard
import com.example.budgetapp.ui.AppViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreditCardsScreen(viewModel: AppViewModel, navController: NavController) {
    val uiState by viewModel.uiState.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }
    var editingCard by remember { mutableStateOf<CreditCard?>(null) }
    var deleteCandidate by remember { mutableStateOf<CreditCard?>(null) }

    val totalDebt = uiState.creditCards.sumOf { it.balanceCents }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Credit Cards") },
                navigationIcon = { BackButton(navController) }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add card")
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            if (totalDebt > 0) {
                Surface(
                    color = MaterialTheme.colorScheme.secondaryContainer,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Total debt: ${formatCents(totalDebt)} — remainder each pay period is applied to debt",
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            if (uiState.creditCards.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("No credit cards added yet.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("Add a card to start tracking debt payoff.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodySmall)
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(uiState.creditCards, key = { it.id }) { card ->
                        CreditCardItem(
                            card = card,
                            onEdit = { editingCard = card },
                            onDelete = { deleteCandidate = card }
                        )
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        CardFormDialog(
            title = "New Credit Card",
            onSave = { name, balance, expiry ->
                viewModel.addCreditCard(name, balance, expiry)
                showAddDialog = false
            },
            onDismiss = { showAddDialog = false }
        )
    }

    editingCard?.let { card ->
        CardFormDialog(
            title = "Edit Credit Card",
            initial = card,
            onSave = { name, balance, expiry ->
                viewModel.updateCreditCard(card.copy(name = name, balanceCents = balance, transferExpirationDate = expiry))
                editingCard = null
            },
            onDismiss = { editingCard = null }
        )
    }

    deleteCandidate?.let { card ->
        AlertDialog(
            onDismissRequest = { deleteCandidate = null },
            title = { Text("Delete Card") },
            text = { Text("Delete \"${card.name}\"?") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteCreditCard(card.id)
                    deleteCandidate = null
                }) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { deleteCandidate = null }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun CreditCardItem(card: CreditCard, onEdit: () -> Unit, onDelete: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(card.name, fontWeight = FontWeight.Medium)
                Text(
                    buildString {
                        append("Balance: ${formatCents(card.balanceCents)}")
                        card.transferExpirationDate?.let {
                            append(" · Transfer expires ${formatExpiryDate(it)}")
                        }
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (card.balanceCents == 0) {
                    Text(
                        "✓ Paid off",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.tertiary
                    )
                }
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
private fun CardFormDialog(
    title: String,
    initial: CreditCard? = null,
    onSave: (name: String, balanceCents: Int, transferExpirationDate: String?) -> Unit,
    onDismiss: () -> Unit
) {
    var name by remember { mutableStateOf(initial?.name ?: "") }
    var balance by remember { mutableStateOf(if (initial != null) dollarsToStr(initial.balanceCents) else "") }
    var expiryDate by remember { mutableStateOf(initial?.transferExpirationDate ?: "") }
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
                    label = { Text("Card Name") },
                    placeholder = { Text("e.g. Chase Freedom") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = balance,
                    onValueChange = { balance = it },
                    label = { Text("Current Balance ($)") },
                    placeholder = { Text("0.00") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = expiryDate,
                    onValueChange = { expiryDate = it },
                    label = { Text("Balance Transfer Expiry (optional, YYYY-MM-DD)") },
                    placeholder = { Text("2025-12-31") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val balanceCents = balance.toDoubleOrNull()
                when {
                    name.isBlank() -> error = "Name is required."
                    balanceCents == null || balanceCents < 0 -> error = "Enter a valid balance (0 or more)."
                    expiryDate.isNotBlank() && !expiryDate.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) ->
                        error = "Expiry date must be in YYYY-MM-DD format."
                    else -> onSave(
                        name.trim(),
                        (balanceCents * 100).toLong().toInt(),
                        expiryDate.trim().takeIf { it.isNotBlank() }
                    )
                }
            }) { Text(if (initial != null) "Save" else "Add Card") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

private fun formatExpiryDate(date: String): String {
    val parts = date.split("-")
    if (parts.size != 3) return date
    val months = arrayOf("Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec")
    val m = parts[1].toIntOrNull()?.minus(1) ?: return date
    val d = parts[2].toIntOrNull() ?: return date
    val y = parts[0]
    return "${months.getOrNull(m) ?: parts[1]} $d, $y"
}
