import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Bill, PaySettings, PeriodOverrides } from '../domain/models';

const KEY_BILLS = 'budgetapp_bills';
const KEY_SETTINGS = 'budgetapp_settings';
const KEY_PERIOD_OVERRIDES = 'budgetapp_period_overrides';

// ── localStorage (local cache) ───────────────────────────────────────────────

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

export function getNextBillId(bills: Bill[]): number {
  return bills.length === 0 ? 1 : Math.max(...bills.map((b) => b.id)) + 1;
}

// ── Firestore (cloud storage) ────────────────────────────────────────────────

export async function loadBillsFromCloud(uid: string): Promise<Bill[] | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'data', 'bills'));
    if (!snap.exists()) return null;
    return (snap.data().bills ?? []) as Bill[];
  } catch {
    return null;
  }
}

export async function saveBillsToCloud(uid: string, bills: Bill[]): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid, 'data', 'bills'), { bills });
  } catch (err) {
    console.error('Failed to save bills to cloud:', err);
  }
}

export async function loadSettingsFromCloud(uid: string): Promise<PaySettings | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'data', 'settings'));
    if (!snap.exists()) return null;
    return (snap.data().settings ?? null) as PaySettings | null;
  } catch {
    return null;
  }
}

export async function saveSettingsToCloud(uid: string, settings: PaySettings): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid, 'data', 'settings'), { settings });
  } catch (err) {
    console.error('Failed to save settings to cloud:', err);
  }
}

export async function loadPeriodOverridesFromCloud(uid: string): Promise<PeriodOverrides | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'data', 'periodOverrides'));
    if (!snap.exists()) return null;
    return (snap.data().overrides ?? {}) as PeriodOverrides;
  } catch {
    return null;
  }
}

export async function savePeriodOverridesToCloud(uid: string, overrides: PeriodOverrides): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid, 'data', 'periodOverrides'), { overrides });
  } catch (err) {
    console.error('Failed to save period overrides to cloud:', err);
  }
}

