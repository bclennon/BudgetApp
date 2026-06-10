package com.example.budgetapp.domain

import java.util.Calendar

/**
 * Returns the ISO date string "YYYY-MM-DD" for the given year, month (1-indexed), and
 * desired [dayOfMonth]. If [dayOfMonth] exceeds the last day of that month the excess days
 * overflow into the following month, matching the web app's behaviour.
 *
 * Examples:
 *   resolveDueDate(2023, 2, 31) → "2023-03-03"  (Feb only has 28 days in 2023)
 *   resolveDueDate(2024, 2, 31) → "2024-03-02"  (Feb has 29 days in leap year 2024)
 *   resolveDueDate(2024, 4, 31) → "2024-05-01"  (April only has 30 days)
 */
fun resolveDueDate(year: Int, month: Int, dayOfMonth: Int): String {
    val cal = Calendar.getInstance().apply {
        set(year, month - 1, 1) // month is 0-indexed in Calendar
    }
    val lastDay = cal.getActualMaximum(Calendar.DAY_OF_MONTH)
    return if (dayOfMonth <= lastDay) {
        "%04d-%02d-%02d".format(year, month, dayOfMonth)
    } else {
        val overflow = dayOfMonth - lastDay
        cal.set(Calendar.DAY_OF_MONTH, lastDay)
        cal.add(Calendar.DAY_OF_MONTH, overflow)
        "%04d-%02d-%02d".format(
            cal.get(Calendar.YEAR),
            cal.get(Calendar.MONTH) + 1,
            cal.get(Calendar.DAY_OF_MONTH)
        )
    }
}
