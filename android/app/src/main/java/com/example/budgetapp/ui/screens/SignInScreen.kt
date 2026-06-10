package com.example.budgetapp.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.budgetapp.ui.AppViewModel

@Composable
fun SignInScreen(
    viewModel: AppViewModel,
    onSignInClick: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            elevation = CardDefaults.cardElevation(4.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "💰",
                    fontSize = 56.sp
                )

                Text(
                    text = "Budget App",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = "Sign in to access your bills and pay period data from any device.",
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                uiState.loadError?.let { error ->
                    Text(
                        text = error,
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center
                    )
                }

                GoogleSignInButton(
                    onClick = onSignInClick,
                    enabled = !uiState.isLoading
                )

                if (uiState.isLoading) {
                    CircularProgressIndicator()
                }
            }
        }
    }
}

@Composable
private fun GoogleSignInButton(onClick: () -> Unit, enabled: Boolean) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Simple Google "G" placeholder — in a real app you would use the official
            // Google branding icon from the Sign-In button guidelines.
            Surface(
                shape = MaterialTheme.shapes.small,
                color = Color(0xFF4285F4),
                modifier = Modifier.size(20.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text("G", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
            Text("Sign in with Google")
        }
    }
}
