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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.budgetapp.domain.model.PayPeriod
import com.example.budgetapp.ui.viewmodel.PayPeriodsViewModel
import java.time.format.DateTimeFormatter

@Composable
fun PayPeriodsScreen(viewModel: PayPeriodsViewModel = viewModel()) {
    val payPeriods by viewModel.payPeriods.collectAsStateWithLifecycle()
    val formatter = DateTimeFormatter.ofPattern("MMM d, yyyy")

    if (payPeriods.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No pay periods. Configure settings to get started.")
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(payPeriods) { period ->
            PayPeriodCard(period = period, formatter = formatter)
        }
    }
}

@Composable
fun PayPeriodCard(period: PayPeriod, formatter: DateTimeFormatter) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = "${period.startDate.format(formatter)} – ${period.endDate.format(formatter)}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text("${period.daysInPeriod} days", style = MaterialTheme.typography.bodySmall)
            HorizontalDivider()

            if (period.bills.isNotEmpty()) {
                Text("Bills:", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                period.bills.forEach { billInPeriod ->
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${billInPeriod.bill.name} (due ${billInPeriod.dueDate.format(DateTimeFormatter.ofPattern("MMM d"))})")
                        Text(formatCents(billInPeriod.bill.amountCents))
                    }
                }
                HorizontalDivider()
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Paycheck", fontWeight = FontWeight.Medium)
                Text(formatCents(period.paycheckAmountCents))
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Bills Total")
                Text("- ${formatCents(period.billsTotalCents)}")
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Remaining", fontWeight = FontWeight.Medium)
                Text(formatCents(period.remainingCents))
            }

            if (period.hasSavings) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Savings", color = MaterialTheme.colorScheme.primary)
                    Text(formatCents(period.savingsTotalCents), color = MaterialTheme.colorScheme.primary)
                }
            }

            HorizontalDivider()
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Spending / day", fontWeight = FontWeight.Bold)
                Text(formatCents(period.displayedSpendingPerDay), fontWeight = FontWeight.Bold)
            }
        }
    }
}

fun formatCents(cents: Long): String {
    val negative = cents < 0
    val abs = Math.abs(cents)
    val dollars = abs / 100
    val centsRemainder = abs % 100
    val formatted = "\$${dollars}.${centsRemainder.toString().padStart(2, '0')}"
    return if (negative) "-$formatted" else formatted
}
