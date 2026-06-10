package com.example.budgetapp.data

import android.content.Context
import com.example.budgetapp.domain.Bill
import com.example.budgetapp.domain.CreditCard
import com.example.budgetapp.domain.PaySettings
import com.example.budgetapp.domain.PeriodOverrides
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

// ── Custom exceptions ─────────────────────────────────────────────────────────

class SpreadsheetNotFoundError(spreadsheetId: String) :
    Exception("Spreadsheet not found (id: $spreadsheetId)")

class SheetTabNotFoundError(val tabName: String) :
    Exception("Sheet tab \"$tabName\" not found in spreadsheet.")

class SheetTabsNotFoundError(val missingTabs: List<String>) :
    Exception("Missing sheet tabs: ${missingTabs.joinToString(", ")}")

// ── Data container ────────────────────────────────────────────────────────────

data class SheetsData(
    val bills: List<Bill>?,
    val settings: PaySettings?,
    val periodOverrides: PeriodOverrides?,
    val creditCards: List<CreditCard>?
)

// ── Repository ────────────────────────────────────────────────────────────────

/**
 * Android equivalent of the web app's sheetsStorage.ts.
 *
 * All data is stored in a single Google Spreadsheet per user, with four
 * sheet tabs (Bills, Settings, PeriodOverrides, CreditCards). Each tab
 * stores its JSON blob in cell A1.
 */
class SheetsRepository(private val context: Context) {

    private val gson = Gson()
    private val client = OkHttpClient()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private val sheetsBase = "https://sheets.googleapis.com/v4/spreadsheets"
    private val driveFilesBase = "https://www.googleapis.com/drive/v3/files"
    private val spreadsheetTitle = "BudgetApp Data"

    private val sheetBills = "Bills"
    private val sheetSettings = "Settings"
    private val sheetOverrides = "PeriodOverrides"
    private val sheetCards = "CreditCards"

    // ── SharedPreferences key helpers ─────────────────────────────────────────

    private fun spreadsheetIdKey(uid: String) = "budgetapp_sheets_id_$uid"

    fun getStoredSpreadsheetId(uid: String): String? =
        context.getSharedPreferences("budgetapp_prefs", Context.MODE_PRIVATE)
            .getString(spreadsheetIdKey(uid), null)

    private fun storeSpreadsheetId(uid: String, id: String) {
        context.getSharedPreferences("budgetapp_prefs", Context.MODE_PRIVATE)
            .edit()
            .putString(spreadsheetIdKey(uid), id)
            .apply()
    }

    fun clearStoredSpreadsheetId(uid: String) {
        context.getSharedPreferences("budgetapp_prefs", Context.MODE_PRIVATE)
            .edit()
            .remove(spreadsheetIdKey(uid))
            .apply()
    }

    // ── HTTP helper ───────────────────────────────────────────────────────────

    private suspend fun sheetsRequest(
        method: String,
        url: String,
        token: String,
        bodyJson: String? = null
    ) = withContext(Dispatchers.IO) {
        val authHeader = "Bearer " + token
        val reqBuilder = Request.Builder()
            .url(url)
            .header("Authorization", authHeader)
        when (method.uppercase()) {
            "GET" -> reqBuilder.get()
            "POST" -> reqBuilder.post(
                (bodyJson ?: "{}").toRequestBody(jsonMediaType)
            )
            "PUT" -> reqBuilder.put(
                (bodyJson ?: "{}").toRequestBody(jsonMediaType)
            )
            else -> throw IllegalArgumentException("Unsupported method: $method")
        }
        client.newCall(reqBuilder.build()).execute()
    }

    // ── Spreadsheet creation / lookup ─────────────────────────────────────────

    private suspend fun createDataSpreadsheet(token: String): String {
        val body = JSONObject().apply {
            put("properties", JSONObject().put("title", spreadsheetTitle))
            put("sheets", org.json.JSONArray().apply {
                for (title in listOf(sheetBills, sheetSettings, sheetOverrides, sheetCards)) {
                    put(JSONObject().put("properties", JSONObject().put("title", title)))
                }
            })
        }
        val res = sheetsRequest("POST", sheetsBase, token, body.toString())
        if (!res.isSuccessful) {
            res.close()
            throw Exception("Failed to create spreadsheet (HTTP ${res.code}).")
        }
        val responseBody = res.body!!.string()
        return JSONObject(responseBody).getString("spreadsheetId")
    }

    private suspend fun findExistingSpreadsheet(token: String): String? {
        val escapedTitle = spreadsheetTitle.replace("\\", "\\\\").replace("'", "\\'")
        val query = "name='$escapedTitle' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
        val url = "$driveFilesBase?q=${java.net.URLEncoder.encode(query, "UTF-8")}&fields=files(id)&pageSize=1"
        return withContext(Dispatchers.IO) {
            val authHeader = "Bearer " + token
            val req = Request.Builder()
                .url(url)
                .header("Authorization", authHeader)
                .get()
                .build()
            val res = client.newCall(req).execute()
            if (!res.isSuccessful) {
                res.close()
                return@withContext null
            }
            val responseJson = JSONObject(res.body!!.string())
            val files = responseJson.optJSONArray("files")
            if (files != null && files.length() > 0) {
                files.getJSONObject(0).getString("id")
            } else null
        }
    }

    /**
     * Returns the spreadsheet ID for this user. Looks up in order:
     * SharedPreferences cache -> existing Drive file -> newly created file.
     */
    suspend fun getOrCreateSpreadsheet(token: String, uid: String): String {
        getStoredSpreadsheetId(uid)?.let { return it }
        val existing = findExistingSpreadsheet(token)
        val id = existing ?: createDataSpreadsheet(token)
        storeSpreadsheetId(uid, id)
        return id
    }

    /** Finds an existing spreadsheet without creating one. Returns null if none found. */
    suspend fun findSpreadsheetId(token: String, uid: String): String? {
        getStoredSpreadsheetId(uid)?.let { return it }
        val existing = findExistingSpreadsheet(token)
        if (existing != null) storeSpreadsheetId(uid, existing)
        return existing
    }

    /**
     * Adds one or more missing sheet tabs to an existing spreadsheet.
     * Used to repair spreadsheets that are missing expected tabs.
     */
    suspend fun addSheetTabsToSpreadsheet(
        token: String,
        spreadsheetId: String,
        tabNames: List<String>
    ) {
        val requests = org.json.JSONArray().apply {
            for (title in tabNames) {
                put(JSONObject().put("addSheet",
                    JSONObject().put("properties", JSONObject().put("title", title))))
            }
        }
        val body = JSONObject().put("requests", requests)
        val res = sheetsRequest("POST", "$sheetsBase/$spreadsheetId:batchUpdate", token, body.toString())
        if (!res.isSuccessful) {
            res.close()
            throw Exception("Failed to add sheet tabs (HTTP ${res.code}).")
        }
        res.close()
    }

    // ── Low-level cell read / write ───────────────────────────────────────────

    private suspend fun <T> readSheetValue(
        token: String,
        spreadsheetId: String,
        sheetName: String,
        typeToken: TypeToken<T>
    ): T? {
        val range = java.net.URLEncoder.encode("$sheetName!A1", "UTF-8")
        val url = "$sheetsBase/$spreadsheetId/values/$range"
        val res = sheetsRequest("GET", url, token)
        if (!res.isSuccessful) {
            val code = res.code
            res.close()
            when (code) {
                404 -> throw SpreadsheetNotFoundError(spreadsheetId)
                400 -> throw SheetTabNotFoundError(sheetName)
                else -> throw Exception("Failed to read sheet \"$sheetName\" (HTTP $code).")
            }
        }
        val body = res.body!!.string()
        val jsonObj = JSONObject(body)
        val values = jsonObj.optJSONArray("values")
        val raw = values?.optJSONArray(0)?.optString(0)
        return if (raw.isNullOrEmpty()) null
        else gson.fromJson(raw, typeToken.type)
    }

    private suspend fun <T> writeSheetValue(
        token: String,
        spreadsheetId: String,
        sheetName: String,
        data: T
    ) {
        val range = java.net.URLEncoder.encode("$sheetName!A1", "UTF-8")
        val url = "$sheetsBase/$spreadsheetId/values/$range?valueInputOption=RAW"
        val jsonData = gson.toJson(data)
        // values is a 2D array: [[cellValue]]
        val body = JSONObject().put("values", org.json.JSONArray().put(org.json.JSONArray().put(jsonData)))
        val res = sheetsRequest("PUT", url, token, body.toString())
        if (!res.isSuccessful) {
            val code = res.code
            res.close()
            throw Exception("Failed to write to sheet \"$sheetName\" (HTTP $code).")
        }
        res.close()
    }

    // ── Public load / save API ────────────────────────────────────────────────

    /** Loads all four data types from the spreadsheet in parallel. */
    suspend fun loadAllFromSheets(token: String, spreadsheetId: String): SheetsData =
        coroutineScope {
            val billsDeferred = async {
                runCatching {
                    readSheetValue(token, spreadsheetId, sheetBills,
                        object : TypeToken<List<Bill>>() {})
                }
            }
            val settingsDeferred = async {
                runCatching {
                    readSheetValue(token, spreadsheetId, sheetSettings,
                        object : TypeToken<PaySettings>() {})
                }
            }
            val overridesDeferred = async {
                runCatching {
                    readSheetValue(token, spreadsheetId, sheetOverrides,
                        object : TypeToken<PeriodOverrides>() {})
                }
            }
            val cardsDeferred = async {
                runCatching {
                    readSheetValue(token, spreadsheetId, sheetCards,
                        object : TypeToken<List<CreditCard>>() {})
                }
            }

            val billsResult = billsDeferred.await()
            val settingsResult = settingsDeferred.await()
            val overridesResult = overridesDeferred.await()
            val cardsResult = cardsDeferred.await()

            // Collect missing-tab errors; re-throw any other errors immediately.
            val missingTabs = mutableListOf<String>()
            listOf(
                billsResult to sheetBills,
                settingsResult to sheetSettings,
                overridesResult to sheetOverrides,
                cardsResult to sheetCards
            ).forEach { (result, name) ->
                result.onFailure { e ->
                    if (e is SheetTabNotFoundError) missingTabs.add(e.tabName)
                    else throw e
                }
            }
            if (missingTabs.isNotEmpty()) throw SheetTabsNotFoundError(missingTabs)

            SheetsData(
                bills = billsResult.getOrNull(),
                settings = settingsResult.getOrNull(),
                periodOverrides = overridesResult.getOrNull(),
                creditCards = cardsResult.getOrNull()
            )
        }

    suspend fun saveBillsToSheets(token: String, spreadsheetId: String, bills: List<Bill>) {
        writeSheetValue(token, spreadsheetId, sheetBills, bills)
    }

    suspend fun saveSettingsToSheets(token: String, spreadsheetId: String, settings: PaySettings) {
        writeSheetValue(token, spreadsheetId, sheetSettings, settings)
    }

    suspend fun savePeriodOverridesToSheets(
        token: String,
        spreadsheetId: String,
        overrides: PeriodOverrides
    ) {
        writeSheetValue(token, spreadsheetId, sheetOverrides, overrides)
    }

    suspend fun saveCreditCardsToSheets(
        token: String,
        spreadsheetId: String,
        cards: List<CreditCard>
    ) {
        writeSheetValue(token, spreadsheetId, sheetCards, cards)
    }
}
