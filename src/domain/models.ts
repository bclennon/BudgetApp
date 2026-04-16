export type Frequency = 'WEEKLY' | 'BIWEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY';

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
  targetSpendingPerDayCents: number;
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
}

/** Map of period startDate → override. */
export type PeriodOverrides = Record<string, PayPeriodOverride>;

/** Returns a blank PayPeriodOverride (no changes). */
export function emptyOverride(): PayPeriodOverride {
  return { oneTimeBills: [], movedInBills: [], movedOutBillIds: [] };
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
  displayedSpendingPerDay: number;
  savingsTotalCents: number;
  hasSavings: boolean;
}

export interface BackupData {
  schemaVersion: number;
  exportedAt: string;
  settings: PaySettings | null;
  bills: Bill[];
}
