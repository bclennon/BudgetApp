package com.example.budgetapp.auth

import android.app.Activity
import android.content.Context
import android.content.Intent
import com.google.android.gms.auth.GoogleAuthUtil
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.Scope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

/** OAuth 2.0 scopes required to read and write the user's Google Sheets data. */
private const val SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"
private const val DRIVE_METADATA_SCOPE = "https://www.googleapis.com/auth/drive.metadata.readonly"

/**
 * Android equivalent of the web app's [AuthContext].
 *
 * Manages Google Sign-In and Firebase Auth, and exposes helpers to get a
 * fresh OAuth access token for Google Sheets REST API calls.
 *
 * Usage (in Activity):
 * 1. Call [buildSignInIntent] and start the activity for result.
 * 2. Pass the result [Intent] to [handleSignInResult].
 * 3. Retrieve the access token from [getSheetsAccessToken].
 */
class AuthManager(private val context: Context) {

    private val firebaseAuth: FirebaseAuth = FirebaseAuth.getInstance()

    /**
     * The OAuth web-client ID from the Firebase project (the "client_type: 3" entry
     * in google-services.json). Required to exchange the Google ID token for a
     * Firebase credential and to obtain an access token via GoogleAuthUtil.
     *
     * Set this from BuildConfig or a local config file. It should look like:
     *   "123456789-xxxx.apps.googleusercontent.com"
     */
    var webClientId: String = ""

    val currentUser: FirebaseUser?
        get() = firebaseAuth.currentUser

    private fun buildSignInOptions(): GoogleSignInOptions =
        GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(webClientId)
            .requestEmail()
            .requestScopes(Scope(SHEETS_SCOPE), Scope(DRIVE_METADATA_SCOPE))
            .build()

    private fun getSignInClient(): GoogleSignInClient =
        GoogleSignIn.getClient(context, buildSignInOptions())

    /** Returns an [Intent] to launch the Google Sign-In flow. */
    fun buildSignInIntent(): Intent = getSignInClient().signInIntent

    /**
     * Handles the result from the Google Sign-In activity.
     * Authenticates with Firebase Auth and returns the signed-in [FirebaseUser].
     *
     * @throws Exception if sign-in fails.
     */
    suspend fun handleSignInResult(data: Intent?): FirebaseUser {
        val account = GoogleSignIn.getSignedInAccountFromIntent(data).await()
        val credential = GoogleAuthProvider.getCredential(account.idToken, null)
        val authResult = firebaseAuth.signInWithCredential(credential).await()
        return authResult.user ?: throw Exception("Firebase sign-in returned null user.")
    }

    /**
     * Returns a valid OAuth2 access token for the Sheets + Drive scopes.
     * Retrieves it via [GoogleAuthUtil.getToken], which handles silent refresh
     * automatically. Must be called from a coroutine (runs on [Dispatchers.IO]).
     *
     * Call this each time you need a token (tokens can expire).
     *
     * @throws Exception if no Google account is signed in, or token retrieval fails.
     */
    suspend fun getSheetsAccessToken(): String = withContext(Dispatchers.IO) {
        val account = GoogleSignIn.getLastSignedInAccount(context)
            ?: throw Exception("No Google account is signed in. Please sign in again.")
        val scopeString = "oauth2:$SHEETS_SCOPE $DRIVE_METADATA_SCOPE"
        GoogleAuthUtil.getToken(context, account.account!!, scopeString)
    }

    /** Signs out from both Firebase Auth and Google Sign-In. */
    suspend fun signOut() {
        firebaseAuth.signOut()
        getSignInClient().signOut().await()
    }

    /** Sets up a listener that fires whenever the Firebase Auth state changes. */
    fun addAuthStateListener(listener: FirebaseAuth.AuthStateListener) {
        firebaseAuth.addAuthStateListener(listener)
    }

    fun removeAuthStateListener(listener: FirebaseAuth.AuthStateListener) {
        firebaseAuth.removeAuthStateListener(listener)
    }
}
