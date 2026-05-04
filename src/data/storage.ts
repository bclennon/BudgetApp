import type { Bill, CreditCard, PaySettings, PeriodOverrides } from '../domain/models';

const KEY_BILLS = 'budgetapp_bills';
const KEY_SETTINGS = 'budgetapp_settings';
const KEY_PERIOD_OVERRIDES = 'budgetapp_period_overrides';
const KEY_CREDIT_CARDS = 'budgetapp_credit_cards';
const KEY_CACHE_TS = 'budgetapp_cache_ts';

/** Cache TTL in milliseconds (20 minutes). */
export const CACHE_TTL_MS = 20 * 60 * 1000;

// ── Cache TTL helpers ─────────────────────────────────────────────────────────

/** Returns true if the localStorage cache is still within the 20-minute TTL. */
export function isCacheValid(): boolean {
  try {
    const raw = localStorage.getItem(KEY_CACHE_TS);
    if (!raw) return false;
    return Date.now() - Number(raw) < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

/** Updates the cache timestamp to now. Called by every save function. */
function refreshCacheTimestamp(): void {
  try {
    localStorage.setItem(KEY_CACHE_TS, String(Date.now()));
  } catch {
    // Silently ignore storage errors (e.g. quota exceeded, private browsing restrictions).
  }
}

// ── localStorage ─────────────────────────────────────────────────────────────

export function loadBills(): Bill[] {
  if (!isCacheValid()) return [];
  try {
    const raw = localStorage.getItem(KEY_BILLS);
    return raw ? (JSON.parse(raw) as Bill[]) : [];
  } catch {
    return [];
  }
}

export function saveBills(bills: Bill[]): void {
  localStorage.setItem(KEY_BILLS, JSON.stringify(bills));
  refreshCacheTimestamp();
}

export function loadSettings(): PaySettings | null {
  if (!isCacheValid()) return null;
  try {
    const raw = localStorage.getItem(KEY_SETTINGS);
    return raw ? (JSON.parse(raw) as PaySettings) : null;
  } catch {
    return null;
  }
}

export function saveSettings(settings: PaySettings): void {
  localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
  refreshCacheTimestamp();
}

export function loadPeriodOverrides(): PeriodOverrides {
  if (!isCacheValid()) return {};
  try {
    const raw = localStorage.getItem(KEY_PERIOD_OVERRIDES);
    return raw ? (JSON.parse(raw) as PeriodOverrides) : {};
  } catch {
    return {};
  }
}

export function savePeriodOverrides(overrides: PeriodOverrides): void {
  localStorage.setItem(KEY_PERIOD_OVERRIDES, JSON.stringify(overrides));
  refreshCacheTimestamp();
}

export function loadCreditCards(): CreditCard[] {
  if (!isCacheValid()) return [];
  try {
    const raw = localStorage.getItem(KEY_CREDIT_CARDS);
    return raw ? (JSON.parse(raw) as CreditCard[]) : [];
  } catch {
    return [];
  }
}

export function saveCreditCards(cards: CreditCard[]): void {
  localStorage.setItem(KEY_CREDIT_CARDS, JSON.stringify(cards));
  refreshCacheTimestamp();
}

export function getNextBillId(bills: Bill[]): number {
  return bills.length === 0 ? 1 : Math.max(...bills.map((b) => b.id)) + 1;
}

