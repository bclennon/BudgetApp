package com.example.budgetapp.domain.model

data class Bill(
    val id: Long = 0,
    val name: String,
    val dayOfMonth: Int,
    val amountCents: Long
)
