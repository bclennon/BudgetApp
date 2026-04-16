package com.example.budgetapp.domain

import com.example.budgetapp.domain.model.Frequency
import com.example.budgetapp.domain.model.PaySettings
import org.junit.Test
import java.time.LocalDate
import kotlin.test.assertEquals

class PayPeriodGeneratorTest {

    private fun makeSettings(
        nextPayday: LocalDate,
        frequency: Frequency,
        paycheckCents: Long = 300000L,
        targetCents: Long = 10000L
    ) = PaySettings(
        paycheckAmountCents = paycheckCents,
        frequency = frequency,
        nextPayday = nextPayday,
        targetSpendingPerDayCents = targetCents
    )

    @Test
    fun `weekly 3 periods from 2024-01-01`() {
        val settings = makeSettings(LocalDate.of(2024, 1, 1), Frequency.WEEKLY)
        val periods = PayPeriodGenerator.generate(settings, emptyList(), count = 3)
        assertEquals(3, periods.size)
        assertEquals(LocalDate.of(2024, 1, 1), periods[0].startDate)
        assertEquals(LocalDate.of(2024, 1, 7), periods[0].endDate)
        assertEquals(LocalDate.of(2024, 1, 8), periods[1].startDate)
        assertEquals(LocalDate.of(2024, 1, 14), periods[1].endDate)
        assertEquals(LocalDate.of(2024, 1, 15), periods[2].startDate)
        assertEquals(LocalDate.of(2024, 1, 21), periods[2].endDate)
    }

    @Test
    fun `biweekly 3 periods from 2024-01-01`() {
        val settings = makeSettings(LocalDate.of(2024, 1, 1), Frequency.BIWEEKLY)
        val periods = PayPeriodGenerator.generate(settings, emptyList(), count = 3)
        assertEquals(3, periods.size)
        assertEquals(LocalDate.of(2024, 1, 1), periods[0].startDate)
        assertEquals(LocalDate.of(2024, 1, 14), periods[0].endDate)
        assertEquals(LocalDate.of(2024, 1, 15), periods[1].startDate)
        assertEquals(LocalDate.of(2024, 1, 28), periods[1].endDate)
        assertEquals(LocalDate.of(2024, 1, 29), periods[2].startDate)
        assertEquals(LocalDate.of(2024, 2, 11), periods[2].endDate)
    }

    @Test
    fun `semi-monthly 4 periods from 2024-01-15`() {
        val settings = makeSettings(LocalDate.of(2024, 1, 15), Frequency.SEMI_MONTHLY)
        val periods = PayPeriodGenerator.generate(settings, emptyList(), count = 4)
        assertEquals(4, periods.size)
        assertEquals(LocalDate.of(2024, 1, 15), periods[0].startDate)
        assertEquals(LocalDate.of(2024, 1, 29), periods[0].endDate)
        assertEquals(LocalDate.of(2024, 1, 30), periods[1].startDate)
        assertEquals(LocalDate.of(2024, 2, 14), periods[1].endDate)
        assertEquals(LocalDate.of(2024, 2, 15), periods[2].startDate)
        assertEquals(LocalDate.of(2024, 2, 29), periods[2].endDate)
        assertEquals(LocalDate.of(2024, 3, 1), periods[3].startDate)
        assertEquals(LocalDate.of(2024, 3, 14), periods[3].endDate)
    }

    @Test
    fun `monthly 3 periods from 2024-01-31`() {
        val settings = makeSettings(LocalDate.of(2024, 1, 31), Frequency.MONTHLY)
        val periods = PayPeriodGenerator.generate(settings, emptyList(), count = 3)
        assertEquals(3, periods.size)
        assertEquals(LocalDate.of(2024, 1, 31), periods[0].startDate)
        assertEquals(LocalDate.of(2024, 3, 2), periods[1].startDate)
        assertEquals(LocalDate.of(2024, 4, 2), periods[2].startDate)
    }
}
