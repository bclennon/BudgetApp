package com.example.budgetapp.data.backup

import android.content.ContentResolver
import android.net.Uri
import kotlinx.serialization.json.Json
import java.io.IOException

class BackupManager(private val contentResolver: ContentResolver) {

    fun writeBackup(uri: Uri, backup: BackupDto) {
        val json = Json.encodeToString(BackupDto.serializer(), backup)
        contentResolver.openOutputStream(uri, "wt")?.use { stream ->
            stream.write(json.toByteArray(Charsets.UTF_8))
        }
    }

    fun readBackup(uri: Uri): BackupDto {
        val json = contentResolver.openInputStream(uri)?.use { stream ->
            stream.readBytes().toString(Charsets.UTF_8)
        } ?: throw IOException("Cannot open backup file")
        return Json.decodeFromString(BackupDto.serializer(), json)
    }
}
