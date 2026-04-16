import type { Bill, PaySettings } from '../domain/models';

const KEY_BILLS = 'budgetapp_bills';
const KEY_SETTINGS = 'budgetapp_settings';

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

export function getNextBillId(bills: Bill[]): number {
  return bills.length === 0 ? 1 : Math.max(...bills.map((b) => b.id)) + 1;
}
