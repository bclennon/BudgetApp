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

export interface BillInPeriod {
  bill: Bill;
  dueDate: string; // "YYYY-MM-DD"
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
