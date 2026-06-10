package com.example.budgetapp

import com.example.budgetapp.domain.resolveDueDate
import org.junit.Assert.assertEquals
import org.junit.Test

class BillDueDateResolverTest {

    @Test
    fun `feb 31 non-leap year overflows to mar 3`() {
        assertEquals("2023-03-03", resolveDueDate(2023, 2, 31))
    }

    @Test
    fun `feb 31 leap year overflows to mar 2`() {
        assertEquals("2024-03-02", resolveDueDate(2024, 2, 31))
    }

    @Test
    fun `apr 31 overflows to may 1`() {
        assertEquals("2024-05-01", resolveDueDate(2024, 4, 31))
    }

    @Test
    fun `dec 31 no overflow`() {
        assertEquals("2024-12-31", resolveDueDate(2024, 12, 31))
    }

    @Test
    fun `jan 28 no overflow`() {
        assertEquals("2024-01-28", resolveDueDate(2024, 1, 28))
    }

    @Test
    fun `feb 28 non-leap no overflow`() {
        assertEquals("2023-02-28", resolveDueDate(2023, 2, 28))
    }
}
