import type { Bill, CreditCard, PaySettings, PeriodOverrides } from '../domain/models';

const KEY_BILLS = 'budgetapp_bills';
const KEY_SETTINGS = 'budgetapp_settings';
const KEY_PERIOD_OVERRIDES = 'budgetapp_period_overrides';
const KEY_CREDIT_CARDS = 'budgetapp_credit_cards';

// ── localStorage ─────────────────────────────────────────────────────────────

export function loadBills(): Bill[] {
  try {
    const raw = localStorage.getItem(KEY_BILLS);
    return raw ? (JSON.parse(raw) as Bill[]) : [];
  } catch {
    return [];
  }
}

export function saveBills(bills: Bill[]): void {
  localStorage.setItem(KEY_BILLS, JSON.stringify(bills));
}

export function loadSettings(): PaySettings | null {
  try {
    const raw = localStorage.getItem(KEY_SETTINGS);
    return raw ? (JSON.parse(raw) as PaySettings) : null;
  } catch {
    return null;
  }
}

export function saveSettings(settings: PaySettings): void {
  localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
}

export function loadPeriodOverrides(): PeriodOverrides {
  try {
    const raw = localStorage.getItem(KEY_PERIOD_OVERRIDES);
    return raw ? (JSON.parse(raw) as PeriodOverrides) : {};
  } catch {
    return {};
  }
}

export function savePeriodOverrides(overrides: PeriodOverrides): void {
  localStorage.setItem(KEY_PERIOD_OVERRIDES, JSON.stringify(overrides));
}

export function loadCreditCards(): CreditCard[] {
  try {
    const raw = localStorage.getItem(KEY_CREDIT_CARDS);
    return raw ? (JSON.parse(raw) as CreditCard[]) : [];
  } catch {
    return [];
  }
}

export function saveCreditCards(cards: CreditCard[]): void {
  localStorage.setItem(KEY_CREDIT_CARDS, JSON.stringify(cards));
}

export function getNextBillId(bills: Bill[]): number {
  return bills.length === 0 ? 1 : Math.max(...bills.map((b) => b.id)) + 1;
}

