package com.example.budgetapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.example.budgetapp.ui.AppNavigation
import com.example.budgetapp.ui.AppViewModel
import com.example.budgetapp.ui.screens.SignInScreen

class MainActivity : ComponentActivity() {

    private val viewModel: AppViewModel by viewModels()

    // Register the sign-in result handler before onCreate (required by Activity Result API)
    private val signInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        // Always forward to the ViewModel regardless of resultCode.
        // handleSignInResult extracts either the signed-in account or a meaningful
        // error (e.g. DEVELOPER_ERROR, API_NOT_CONNECTED) via
        // GoogleSignIn.getSignedInAccountFromIntent, which works for all result codes.
        viewModel.handleSignInResult(result.data)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Set the web client ID from the Firebase project configuration.
        // This value is the "client_id" under "client_type: 3" in google-services.json,
        // e.g. "123456789-xxxx.apps.googleusercontent.com".
        // You can also pass this via BuildConfig by adding it to your build.gradle:
        //   buildConfigField("String", "WEB_CLIENT_ID", "\"your-web-client-id\"")
        viewModel.authManager.webClientId = getString(R.string.default_web_client_id)

        setContent {
            MaterialTheme {
                val uiState by viewModel.uiState.collectAsState()
                if (!uiState.isSignedIn) {
                    SignInScreen(
                        viewModel = viewModel,
                        onSignInClick = {
                            signInLauncher.launch(viewModel.buildSignInIntent())
                        }
                    )
                } else {
                    AppNavigation(viewModel = viewModel)
                }
            }
        }
    }
}
