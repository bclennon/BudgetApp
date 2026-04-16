package com.example.budgetapp.domain

import java.time.LocalDate
import java.time.Month
import java.time.YearMonth

object BillDueDateResolver {
    fun resolveDueDate(year: Int, month: Month, dayOfMonth: Int): LocalDate {
        val lastDay = YearMonth.of(year, month).lengthOfMonth()
        return if (dayOfMonth <= lastDay) {
            LocalDate.of(year, month, dayOfMonth)
        } else {
            val overflow = dayOfMonth - lastDay
            LocalDate.of(year, month, lastDay).plusDays(overflow.toLong())
        }
    }
}
