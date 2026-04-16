package com.example.budgetapp.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.example.budgetapp.ui.screens.BackupSyncScreen
import com.example.budgetapp.ui.screens.BillsScreen
import com.example.budgetapp.ui.screens.PayPeriodsScreen
import com.example.budgetapp.ui.screens.SettingsScreen

sealed class Screen(val route: String, val label: String, val icon: ImageVector) {
    object PayPeriods : Screen("pay_periods", "Pay Periods", Icons.Default.DateRange)
    object Bills : Screen("bills", "Bills", Icons.Default.List)
    object Settings : Screen("settings", "Settings", Icons.Default.Settings)
    object BackupSync : Screen("backup_sync", "Backup", Icons.Default.Star)
}

val screens = listOf(Screen.PayPeriods, Screen.Bills, Screen.Settings, Screen.BackupSync)

@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    Scaffold(
        bottomBar = {
            NavigationBar {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination
                screens.forEach { screen ->
                    NavigationBarItem(
                        icon = { Icon(screen.icon, contentDescription = screen.label) },
                        label = { Text(screen.label) },
                        selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.PayPeriods.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.PayPeriods.route) { PayPeriodsScreen() }
            composable(Screen.Bills.route) { BillsScreen() }
            composable(Screen.Settings.route) { SettingsScreen() }
            composable(Screen.BackupSync.route) { BackupSyncScreen() }
        }
    }
}
