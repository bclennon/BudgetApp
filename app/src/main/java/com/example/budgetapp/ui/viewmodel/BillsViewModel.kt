package com.example.budgetapp.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.budgetapp.BudgetApplication
import com.example.budgetapp.data.db.BillEntity
import com.example.budgetapp.domain.model.Bill
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class BillsViewModel(application: Application) : AndroidViewModel(application) {

    private val billDao = (application as BudgetApplication).database.billDao()

    val bills: StateFlow<List<Bill>> = billDao.getAllBills()
        .map { entities -> entities.map { Bill(it.id, it.name, it.dayOfMonth, it.amountCents) } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun addBill(name: String, dayOfMonth: Int, amountCents: Long) {
        viewModelScope.launch {
            billDao.insertBill(BillEntity(name = name, dayOfMonth = dayOfMonth, amountCents = amountCents))
        }
    }

    fun updateBill(bill: Bill) {
        viewModelScope.launch {
            billDao.updateBill(BillEntity(bill.id, bill.name, bill.dayOfMonth, bill.amountCents))
        }
    }

    fun deleteBill(bill: Bill) {
        viewModelScope.launch {
            billDao.deleteBillById(bill.id)
        }
    }
}
