package com.example.budgetapp.ui

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.budgetapp.ui.screens.*

sealed class Screen(val route: String) {
    object SignIn : Screen("sign_in")
    object PayPeriods : Screen("pay_periods")
    object Bills : Screen("bills")
    object CreditCards : Screen("credit_cards")
    object Settings : Screen("settings")
    object ArchivedPeriods : Screen("archived_periods")
    object BackupSync : Screen("backup_sync")
}

@Composable
fun AppNavigation(
    viewModel: AppViewModel,
    navController: NavHostController = rememberNavController()
) {
    NavHost(navController = navController, startDestination = Screen.PayPeriods.route) {
        composable(Screen.PayPeriods.route) {
            PayPeriodsScreen(viewModel = viewModel, navController = navController)
        }
        composable(Screen.Bills.route) {
            BillsScreen(viewModel = viewModel, navController = navController)
        }
        composable(Screen.CreditCards.route) {
            CreditCardsScreen(viewModel = viewModel, navController = navController)
        }
        composable(Screen.Settings.route) {
            SettingsScreen(viewModel = viewModel, navController = navController)
        }
        composable(Screen.ArchivedPeriods.route) {
            ArchivedPeriodsScreen(viewModel = viewModel, navController = navController)
        }
        composable(Screen.BackupSync.route) {
            BackupSyncScreen(viewModel = viewModel, navController = navController)
        }
    }
}
