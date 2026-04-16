package com.example.budgetapp.data.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface PaySettingsDao {
    @Query("SELECT * FROM pay_settings WHERE id = 1")
    fun getPaySettings(): Flow<PaySettingsEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdatePaySettings(settings: PaySettingsEntity)
}
