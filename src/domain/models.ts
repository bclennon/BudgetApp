export type Frequency = 'WEEKLY' | 'BIWEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY';

export type BillPaymentStatus = 'submitted' | 'processed';

export interface CreditCard {
  id: string;
  name: string;
  balanceCents: number;
  transferExpirationDate?: string; // "YYYY-MM-DD", optional balance-transfer expiry
}

export interface Bill {
  id: number;
  name: string;
  dayOfMonth: number; // 1-31
  amountCents: number;
  url?: string; // optional payment URL
}

export interface PaySettings {
  paycheckAmountCents: number;
  frequency: Frequency;
  nextPayday: string; // "YYYY-MM-DD"
  minSpendPerDayCents: number; // minimum daily spending amount in cents to keep before applying surplus to credit cards
}

/** A bill manually added to a specific pay period (not recurring). */
export interface OneTimeBill {
  id: string;
  name: string;
  amountCents: number;
  dueDate: string; // "YYYY-MM-DD"
}

/** A single credit-card payment recorded for a pay period. */
export interface CreditCardPayment {
  cardId: string;
  amountCents: number;
}

/** Per-pay-period user overrides. */
export interface PayPeriodOverride {
  paycheckAmountCents?: number; // override the default paycheck for this period
  oneTimeBills: OneTimeBill[];  // manually added one-time bills
  movedInBills: { billId: number; fromPeriodStart: string; dueDate: string }[]; // recurring bills moved into this period
  movedOutBillIds: number[]; // recurring bill IDs moved out of this period
  /** Map of bill key → payment status. Key: String(bill.id) for recurring/moved bills, oneTimeBill.id for one-time bills. */
  billPaymentStatuses: Record<string, BillPaymentStatus>;
  /**
   * Per-card payment statuses for this period (key = card.id).
   * When present, each card's status is tracked independently.
   * When absent, falls back to the legacy `creditCardPaymentStatus` field.
   */
  creditCardPaymentStatuses?: Record<string, BillPaymentStatus>;
  /** @deprecated Use creditCardPaymentStatuses instead. Kept for backward compatibility. */
  creditCardPaymentStatus?: BillPaymentStatus;
  /**
   * Payments to one or more credit cards for this period (set when processed).
   * Supersedes the legacy single-card fields below.
   */
  creditCardPayments?: CreditCardPayment[];
  /** @deprecated Use creditCardPayments instead. Kept for backward compatibility. */
  creditCardPaymentAmountCents?: number;
  /** @deprecated Use creditCardPayments instead. Kept for backward compatibility. */
  creditCardPaymentCardId?: string;
}

/** Map of period startDate → override. */
export type PeriodOverrides = Record<string, PayPeriodOverride>;

/** Returns a blank PayPeriodOverride (no changes). */
export function emptyOverride(): PayPeriodOverride {
  return { oneTimeBills: [], movedInBills: [], movedOutBillIds: [], billPaymentStatuses: {} };
}

function sortedCardsWithBalance(cards: CreditCard[]): CreditCard[] {
  return cards
    .filter((c) => c.balanceCents > 0)
    .slice()
    .sort((a, b) => {
      if (a.transferExpirationDate && b.transferExpirationDate) {
        return a.transferExpirationDate.localeCompare(b.transferExpirationDate);
      }
      if (a.transferExpirationDate) return -1;
      if (b.transferExpirationDate) return 1;
      return a.name.localeCompare(b.name);
    });
}

/** Returns the credit card that should be paid first (earliest expiration date, then no-date cards). */
export function getPriorityCard(cards: CreditCard[]): CreditCard | null {
  const sorted = sortedCardsWithBalance(cards);
  return sorted.length > 0 ? sorted[0] : null;
}

/**
 * Allocates availableCents across credit cards in priority order.
 * If availableCents exceeds the first card's balance, the remainder cascades
 * to the next card(s) in line.
 */
export function getPlannedCardPayments(
  availableCents: number,
  cards: CreditCard[],
): Array<{ card: CreditCard; amountCents: number }> {
  const result: Array<{ card: CreditCard; amountCents: number }> = [];
  let remaining = availableCents;
  for (const card of sortedCardsWithBalance(cards)) {
    if (remaining <= 0) break;
    const amount = Math.min(remaining, card.balanceCents);
    result.push({ card, amountCents: amount });
    remaining -= amount;
  }
  return result;
}

export interface BillInPeriod {
  bill: Bill;
  dueDate: string; // "YYYY-MM-DD"
  isOneTime?: boolean;       // true if manually added as a one-time bill
  oneTimeBillId?: string;    // OneTimeBill.id when isOneTime is true
  movedFromPeriod?: string;  // source period startDate when moved in
}

export interface PayPeriod {
  startDate: string;
  endDate: string;
  bills: BillInPeriod[];
  paycheckAmountCents: number;
  billsTotalCents: number;
  remainingCents: number;
  daysInPeriod: number;
  spendingPerDayRaw: number;
  /** Daily spend capped at minSpendPerDayCents (equals spendingPerDayRaw when there is no surplus). */
  displayedSpendingPerDay: number;
  /** Cents above the minimum daily spend threshold — available to put toward credit cards. */
  surplusCents: number;
  /** True when there are surplus funds above the minimum daily spend. */
  hasSurplus: boolean;
}

export interface BackupData {
  schemaVersion: number;
  exportedAt: string;
  settings: PaySettings | null;
  bills: Bill[];
}
