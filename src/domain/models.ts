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
}

export interface PaySettings {
  paycheckAmountCents: number;
  frequency: Frequency;
  nextPayday: string; // "YYYY-MM-DD"
  bankLinked?: boolean; // true once a bank account has been linked via Sophtron
}

/** A bill manually added to a specific pay period (not recurring). */
export interface OneTimeBill {
  id: string;
  name: string;
  amountCents: number;
  dueDate: string; // "YYYY-MM-DD"
}

/** Per-pay-period user overrides. */
export interface PayPeriodOverride {
  paycheckAmountCents?: number; // override the default paycheck for this period
  oneTimeBills: OneTimeBill[];  // manually added one-time bills
  movedInBills: { billId: number; fromPeriodStart: string; dueDate: string }[]; // recurring bills moved into this period
  movedOutBillIds: number[]; // recurring bill IDs moved out of this period
  /** Map of bill key → payment status. Key: String(bill.id) for recurring/moved bills, oneTimeBill.id for one-time bills. */
  billPaymentStatuses: Record<string, BillPaymentStatus>;
  /** Tracks the payment status of the credit-card debt payment for this period. */
  creditCardPaymentStatus?: BillPaymentStatus;
  /** Amount (cents) that was applied to the credit card when marked as processed. */
  creditCardPaymentAmountCents?: number;
  /** ID of the credit card that received the payment. */
  creditCardPaymentCardId?: string;
}

/** Map of period startDate → override. */
export type PeriodOverrides = Record<string, PayPeriodOverride>;

/** Returns a blank PayPeriodOverride (no changes). */
export function emptyOverride(): PayPeriodOverride {
  return { oneTimeBills: [], movedInBills: [], movedOutBillIds: [], billPaymentStatuses: {} };
}

/** Returns the credit card that should be paid first (earliest expiration date, then no-date cards). */
export function getPriorityCard(cards: CreditCard[]): CreditCard | null {
  const withBalance = cards.filter((c) => c.balanceCents > 0);
  if (withBalance.length === 0) return null;
  return withBalance.slice().sort((a, b) => {
    if (a.transferExpirationDate && b.transferExpirationDate) {
      return a.transferExpirationDate.localeCompare(b.transferExpirationDate);
    }
    if (a.transferExpirationDate) return -1;
    if (b.transferExpirationDate) return 1;
    return a.name.localeCompare(b.name);
  })[0];
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
}

export interface BackupData {
  schemaVersion: number;
  exportedAt: string;
  settings: PaySettings | null;
  bills: Bill[];
}
