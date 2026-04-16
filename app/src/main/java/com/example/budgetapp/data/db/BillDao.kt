package com.example.budgetapp.data.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface BillDao {
    @Query("SELECT * FROM bills ORDER BY dayOfMonth ASC")
    fun getAllBills(): Flow<List<BillEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBill(bill: BillEntity): Long

    @Update
    suspend fun updateBill(bill: BillEntity)

    @Delete
    suspend fun deleteBill(bill: BillEntity)

    @Query("DELETE FROM bills WHERE id = :id")
    suspend fun deleteBillById(id: Long)

    @Query("DELETE FROM bills")
    suspend fun deleteAllBills()
}
