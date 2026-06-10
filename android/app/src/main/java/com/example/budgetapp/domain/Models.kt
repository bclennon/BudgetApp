package com.example.budgetapp.domain

import com.google.gson.annotations.SerializedName

// ── Enums ────────────────────────────────────────────────────────────────────

enum class Frequency { WEEKLY, BIWEEKLY, SEMI_MONTHLY, MONTHLY }

/** Mirrors the TypeScript BillPaymentStatus type (lowercase JSON values). */
enum class BillPaymentStatus {
    @SerializedName("submitted") SUBMITTED,
    @SerializedName("processed") PROCESSED
}

// ── Core data models ─────────────────────────────────────────────────────────

data class CreditCard(
    val id: String = "",
    val name: String = "",
    val balanceCents: Int = 0,
    val transferExpirationDate: String? = null
)

data class Bill(
    val id: Int = 0,
    val name: String = "",
    val dayOfMonth: Int = 1,
    val amountCents: Int = 0,
    val url: String? = null
)

data class PaySettings(
    val paycheckAmountCents: Int = 0,
    val frequency: Frequency = Frequency.BIWEEKLY,
    val nextPayday: String = "",
    val minSpendPerDayCents: Int = 0
)

data class OneTimeBill(
    val id: String = "",
    val name: String = "",
    val amountCents: Int = 0,
    val dueDate: String = ""
)

data class CreditCardPayment(
    val cardId: String = "",
    val amountCents: Int = 0
)

data class MovedInBill(
    val billId: Int = 0,
    val fromPeriodStart: String = "",
    val dueDate: String = ""
)

/** Per-pay-period user overrides. Field names mirror the TypeScript interface exactly. */
data class PayPeriodOverride(
    val paycheckAmountCents: Int? = null,
    val oneTimeBills: List<OneTimeBill> = emptyList(),
    val movedInBills: List<MovedInBill> = emptyList(),
    val movedOutBillIds: List<Int> = emptyList(),
    val deletedBillIds: List<Int>? = null,
    val billPaymentStatuses: Map<String, BillPaymentStatus> = emptyMap(),
    val billAmountOverrides: Map<String, Int>? = null,
    val creditCardPaymentStatuses: Map<String, BillPaymentStatus>? = null,
    @Deprecated("Use creditCardPaymentStatuses")
    val creditCardPaymentStatus: BillPaymentStatus? = null,
    val creditCardPayments: List<CreditCardPayment>? = null,
    @Deprecated("Use creditCardPayments")
    val creditCardPaymentAmountCents: Int? = null,
    @Deprecated("Use creditCardPayments")
    val creditCardPaymentCardId: String? = null,
    val archived: Boolean = false
)

/** Map of period startDate (YYYY-MM-DD) → override. */
typealias PeriodOverrides = Map<String, PayPeriodOverride>

/** Returns a blank PayPeriodOverride with no changes. */
fun emptyOverride() = PayPeriodOverride()

// ── Computed / display models ─────────────────────────────────────────────────

data class BillInPeriod(
    val bill: Bill,
    val dueDate: String,
    val isOneTime: Boolean = false,
    val oneTimeBillId: String? = null,
    val movedFromPeriod: String? = null,
    val amountOverrideCents: Int? = null
)

data class PayPeriod(
    val startDate: String,
    val endDate: String,
    val bills: List<BillInPeriod>,
    val paycheckAmountCents: Int,
    val billsTotalCents: Int,
    val remainingCents: Int,
    val daysInPeriod: Int,
    val spendingPerDayRaw: Int,
    val displayedSpendingPerDay: Int,
    val surplusCents: Int,
    val hasSurplus: Boolean
)

data class BackupData(
    val schemaVersion: Int = 1,
    val exportedAt: String = "",
    val settings: PaySettings? = null,
    val bills: List<Bill> = emptyList()
)

// ── Credit card payment helpers ───────────────────────────────────────────────

private fun sortedCardsWithBalance(cards: List<CreditCard>): List<CreditCard> =
    cards
        .filter { it.balanceCents > 0 }
        .sortedWith(compareBy(
            // Cards with a balance-transfer expiry date sort first (earliest expiry first)
            { if (it.transferExpirationDate != null) 0 else 1 },
            { it.transferExpirationDate ?: "" },
            { it.name }
        ))

fun getPriorityCard(cards: List<CreditCard>): CreditCard? =
    sortedCardsWithBalance(cards).firstOrNull()

/**
 * Allocates [availableCents] across credit cards in priority order.
 * If [availableCents] exceeds the first card's balance, the remainder
 * cascades to the next card(s).
 */
fun getPlannedCardPayments(
    availableCents: Int,
    cards: List<CreditCard>
): List<Pair<CreditCard, Int>> {
    val result = mutableListOf<Pair<CreditCard, Int>>()
    var remaining = availableCents
    for (card in sortedCardsWithBalance(cards)) {
        if (remaining <= 0) break
        val amount = minOf(remaining, card.balanceCents)
        result.add(card to amount)
        remaining -= amount
    }
    return result
}
