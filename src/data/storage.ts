import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Bill, PaySettings } from '../domain/models';

const KEY_BILLS = 'budgetapp_bills';
const KEY_SETTINGS = 'budgetapp_settings';

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
  await setDoc(doc(db, 'users', uid, 'data', 'bills'), { bills });
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
  await setDoc(doc(db, 'users', uid, 'data', 'settings'), { settings });
}

