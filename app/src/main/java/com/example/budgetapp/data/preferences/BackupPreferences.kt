package com.example.budgetapp.data.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "backup_preferences")

object BackupPreferences {
    private val BACKUP_URI = stringPreferencesKey("backup_uri")
    private val LAST_SYNC_AT = stringPreferencesKey("last_sync_at")

    fun getBackupUri(context: Context): Flow<String?> =
        context.dataStore.data.map { prefs -> prefs[BACKUP_URI] }

    fun getLastSyncAt(context: Context): Flow<String?> =
        context.dataStore.data.map { prefs -> prefs[LAST_SYNC_AT] }

    suspend fun setBackupUri(context: Context, uri: String) {
        context.dataStore.edit { prefs -> prefs[BACKUP_URI] = uri }
    }

    suspend fun setLastSyncAt(context: Context, timestamp: String) {
        context.dataStore.edit { prefs -> prefs[LAST_SYNC_AT] = timestamp }
    }
}
