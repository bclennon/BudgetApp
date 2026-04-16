package com.example.budgetapp.domain

import org.junit.Test
import java.time.Month
import kotlin.test.assertEquals

class BillDueDateTest {

    @Test
    fun `feb 31 non-leap year overflows to mar 3`() {
        val result = BillDueDateResolver.resolveDueDate(2023, Month.FEBRUARY, 31)
        assertEquals(3, result.dayOfMonth)
        assertEquals(Month.MARCH, result.month)
        assertEquals(2023, result.year)
    }

    @Test
    fun `feb 31 leap year overflows to mar 2`() {
        val result = BillDueDateResolver.resolveDueDate(2024, Month.FEBRUARY, 31)
        assertEquals(2, result.dayOfMonth)
        assertEquals(Month.MARCH, result.month)
        assertEquals(2024, result.year)
    }

    @Test
    fun `apr 31 overflows to may 1`() {
        val result = BillDueDateResolver.resolveDueDate(2024, Month.APRIL, 31)
        assertEquals(1, result.dayOfMonth)
        assertEquals(Month.MAY, result.month)
    }

    @Test
    fun `dec 31 no overflow`() {
        val result = BillDueDateResolver.resolveDueDate(2024, Month.DECEMBER, 31)
        assertEquals(31, result.dayOfMonth)
        assertEquals(Month.DECEMBER, result.month)
    }

    @Test
    fun `jan 28 no overflow`() {
        val result = BillDueDateResolver.resolveDueDate(2024, Month.JANUARY, 28)
        assertEquals(28, result.dayOfMonth)
        assertEquals(Month.JANUARY, result.month)
    }

    @Test
    fun `feb 28 non-leap no overflow`() {
        val result = BillDueDateResolver.resolveDueDate(2023, Month.FEBRUARY, 28)
        assertEquals(28, result.dayOfMonth)
        assertEquals(Month.FEBRUARY, result.month)
    }
}
