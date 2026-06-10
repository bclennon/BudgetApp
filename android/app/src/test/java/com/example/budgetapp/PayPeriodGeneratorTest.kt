package com.example.budgetapp

import com.example.budgetapp.domain.*
import org.junit.Assert.*
import org.junit.Test

class PayPeriodGeneratorTest {

    private fun makeSettings(
        nextPayday: String,
        frequency: Frequency,
        paycheckCents: Int = 300000,
        minSpendPerDayCents: Int = 0
    ) = PaySettings(
        paycheckAmountCents = paycheckCents,
        frequency = frequency,
        nextPayday = nextPayday,
        minSpendPerDayCents = minSpendPerDayCents
    )

    @Test
    fun `weekly 3 periods from 2024-01-01`() {
        val periods = generatePayPeriods(makeSettings("2024-01-01", Frequency.WEEKLY), emptyList(), 3)
        assertEquals(3, periods.size)
        assertEquals("2024-01-01", periods[0].startDate)
        assertEquals("2024-01-07", periods[0].endDate)
        assertEquals("2024-01-08", periods[1].startDate)
        assertEquals("2024-01-14", periods[1].endDate)
        assertEquals("2024-01-15", periods[2].startDate)
        assertEquals("2024-01-21", periods[2].endDate)
    }

    @Test
    fun `biweekly 3 periods from 2024-01-01`() {
        val periods = generatePayPeriods(makeSettings("2024-01-01", Frequency.BIWEEKLY), emptyList(), 3)
        assertEquals(3, periods.size)
        assertEquals("2024-01-01", periods[0].startDate)
        assertEquals("2024-01-14", periods[0].endDate)
        assertEquals("2024-01-15", periods[1].startDate)
        assertEquals("2024-01-28", periods[1].endDate)
        assertEquals("2024-01-29", periods[2].startDate)
        assertEquals("2024-02-11", periods[2].endDate)
    }

    @Test
    fun `semi-monthly 4 periods from 2024-01-15`() {
        val periods = generatePayPeriods(makeSettings("2024-01-15", Frequency.SEMI_MONTHLY), emptyList(), 4)
        assertEquals(4, periods.size)
        assertEquals("2024-01-15", periods[0].startDate)
        assertEquals("2024-01-29", periods[0].endDate)
        assertEquals("2024-01-30", periods[1].startDate)
        assertEquals("2024-02-14", periods[1].endDate)
        assertEquals("2024-02-15", periods[2].startDate)
        assertEquals("2024-02-29", periods[2].endDate)
        assertEquals("2024-03-01", periods[3].startDate)
        assertEquals("2024-03-14", periods[3].endDate)
    }

    @Test
    fun `monthly 3 periods from 2024-01-31`() {
        val periods = generatePayPeriods(makeSettings("2024-01-31", Frequency.MONTHLY), emptyList(), 3)
        assertEquals(3, periods.size)
        assertEquals("2024-01-31", periods[0].startDate)
        assertEquals("2024-03-02", periods[1].startDate)
        assertEquals("2024-04-02", periods[2].startDate)
    }

    @Test
    fun `processed bills excluded from billsTotalCents`() {
        val bills = listOf(
            Bill(id = 1, name = "Rent", dayOfMonth = 5, amountCents = 100000),
            Bill(id = 2, name = "Electric", dayOfMonth = 10, amountCents = 5000)
        )
        val settings = makeSettings("2024-01-01", Frequency.MONTHLY, 200000)
        val overrides: PeriodOverrides = mapOf(
            "2024-01-01" to PayPeriodOverride(
                billPaymentStatuses = mapOf("1" to BillPaymentStatus.PROCESSED)
            )
        )
        val periods = generatePayPeriods(settings, bills, 1, overrides)
        assertEquals(5000, periods[0].billsTotalCents)
        assertEquals(200000 - 5000, periods[0].remainingCents)
    }

    @Test
    fun `submitted bills still included in billsTotalCents`() {
        val bills = listOf(Bill(id = 1, name = "Rent", dayOfMonth = 5, amountCents = 100000))
        val settings = makeSettings("2024-01-01", Frequency.MONTHLY, 200000)
        val overrides: PeriodOverrides = mapOf(
            "2024-01-01" to PayPeriodOverride(
                billPaymentStatuses = mapOf("1" to BillPaymentStatus.SUBMITTED)
            )
        )
        val periods = generatePayPeriods(settings, bills, 1, overrides)
        assertEquals(100000, periods[0].billsTotalCents)
        assertEquals(100000, periods[0].remainingCents)
    }

    @Test
    fun `processed one-time bills excluded from billsTotalCents`() {
        val settings = makeSettings("2024-01-01", Frequency.MONTHLY, 200000)
        val overrides: PeriodOverrides = mapOf(
            "2024-01-01" to PayPeriodOverride(
                oneTimeBills = listOf(
                    OneTimeBill(id = "ot-abc", name = "Car repair", amountCents = 30000, dueDate = "2024-01-15")
                ),
                billPaymentStatuses = mapOf("ot-abc" to BillPaymentStatus.PROCESSED)
            )
        )
        val periods = generatePayPeriods(settings, emptyList(), 1, overrides)
        assertEquals(0, periods[0].billsTotalCents)
        assertEquals(200000, periods[0].remainingCents)
    }

    @Test
    fun `surplus is zero when minSpendPerDayCents is 0`() {
        val settings = makeSettings("2024-01-01", Frequency.MONTHLY, 300000, 0)
        val periods = generatePayPeriods(settings, emptyList(), 1)
        assertFalse(periods[0].hasSurplus)
        assertEquals(0, periods[0].surplusCents)
        assertEquals(periods[0].spendingPerDayRaw, periods[0].displayedSpendingPerDay)
    }

    @Test
    fun `surplus computed when minSpendPerDayCents below spendingPerDayRaw`() {
        // Paycheck $3100, no bills, 31-day period (MONTHLY from Jan 1)
        // spendingPerDayRaw = floor(310000 / 31) = 10000
        // minSpendPerDay = 5000, surplus = (10000 - 5000) * 31 = 155000
        val settings = makeSettings("2024-01-01", Frequency.MONTHLY, 310000, 5000)
        val periods = generatePayPeriods(settings, emptyList(), 1)
        assertTrue(periods[0].hasSurplus)
        assertEquals(5000, periods[0].displayedSpendingPerDay)
        assertEquals((10000 - 5000) * periods[0].daysInPeriod, periods[0].surplusCents)
    }

    @Test
    fun `no surplus when spendingPerDayRaw at or below minSpendPerDayCents`() {
        val settings = makeSettings("2024-01-01", Frequency.MONTHLY, 100000, 5000)
        val periods = generatePayPeriods(settings, emptyList(), 1)
        assertFalse(periods[0].hasSurplus)
        assertEquals(0, periods[0].surplusCents)
        assertEquals(periods[0].spendingPerDayRaw, periods[0].displayedSpendingPerDay)
    }

    @Test
    fun `bill amount override replaces original amount in billsTotalCents`() {
        val bills = listOf(
            Bill(id = 1, name = "Rent", dayOfMonth = 5, amountCents = 100000),
            Bill(id = 2, name = "Electric", dayOfMonth = 10, amountCents = 5000)
        )
        val settings = makeSettings("2024-01-01", Frequency.MONTHLY, 200000)
        val overrides: PeriodOverrides = mapOf(
            "2024-01-01" to PayPeriodOverride(
                billAmountOverrides = mapOf("1" to 90000)
            )
        )
        val periods = generatePayPeriods(settings, bills, 1, overrides)
        // 90000 (Rent override) + 5000 (Electric) = 95000
        assertEquals(95000, periods[0].billsTotalCents)
        assertEquals(200000 - 95000, periods[0].remainingCents)
        val rentBip = periods[0].bills.first { it.bill.id == 1 }
        assertEquals(90000, rentBip.amountOverrideCents)
        assertEquals(100000, rentBip.bill.amountCents)
        val elecBip = periods[0].bills.first { it.bill.id == 2 }
        assertNull(elecBip.amountOverrideCents)
    }

    @Test
    fun `bill amount override does not affect other periods`() {
        val bills = listOf(Bill(id = 1, name = "Rent", dayOfMonth = 5, amountCents = 100000))
        val settings = makeSettings("2024-01-01", Frequency.MONTHLY, 200000)
        val overrides: PeriodOverrides = mapOf(
            "2024-01-01" to PayPeriodOverride(
                billAmountOverrides = mapOf("1" to 90000)
            )
        )
        val periods = generatePayPeriods(settings, bills, 2, overrides)
        assertEquals(90000, periods[0].billsTotalCents)
        assertEquals(100000, periods[1].billsTotalCents)
        assertNull(periods[1].bills[0].amountOverrideCents)
    }
}
