import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  isCacheValid,
  CACHE_TTL_MS,
  loadBills,
  saveBills,
  loadSettings,
  saveSettings,
  loadPeriodOverrides,
  savePeriodOverrides,
  loadCreditCards,
  saveCreditCards,
} from '../storage';
import type { Bill, PaySettings } from '../../domain/models';

const KEY_CACHE_TS = 'budgetapp_cache_ts';

// Minimal localStorage mock for the Node test environment.
function makeLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

const localStorageMock = makeLocalStorageMock();
vi.stubGlobal('localStorage', localStorageMock);

describe('isCacheValid', () => {
  beforeEach(() => localStorage.clear());

  it('returns false when no timestamp is stored', () => {
    expect(isCacheValid()).toBe(false);
  });

  it('returns true when timestamp is within the TTL', () => {
    localStorage.setItem(KEY_CACHE_TS, String(Date.now() - CACHE_TTL_MS + 1000));
    expect(isCacheValid()).toBe(true);
  });

  it('returns false when timestamp is exactly at the TTL boundary', () => {
    localStorage.setItem(KEY_CACHE_TS, String(Date.now() - CACHE_TTL_MS));
    expect(isCacheValid()).toBe(false);
  });

  it('returns false when timestamp is older than the TTL', () => {
    localStorage.setItem(KEY_CACHE_TS, String(Date.now() - CACHE_TTL_MS - 1000));
    expect(isCacheValid()).toBe(false);
  });
});

describe('cache TTL integration', () => {
  const bill: Bill = { id: 1, name: 'Rent', amountCents: 100000, dayOfMonth: 1 };
  const settings: PaySettings = { paycheckAmountCents: 300000, frequency: 'MONTHLY', nextPayday: '2024-01-15', minSpendPerDayCents: 5000 };

  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('loadBills returns saved data when cache is fresh', () => {
    saveBills([bill]);
    expect(loadBills()).toEqual([bill]);
  });

  it('loadBills returns empty array when cache is expired', () => {
    saveBills([bill]);
    localStorage.setItem(KEY_CACHE_TS, String(Date.now() - CACHE_TTL_MS - 1000));
    expect(loadBills()).toEqual([]);
  });

  it('loadSettings returns saved data when cache is fresh', () => {
    saveSettings(settings);
    expect(loadSettings()).toEqual(settings);
  });

  it('loadSettings returns null when cache is expired', () => {
    saveSettings(settings);
    localStorage.setItem(KEY_CACHE_TS, String(Date.now() - CACHE_TTL_MS - 1000));
    expect(loadSettings()).toBeNull();
  });

  it('loadPeriodOverrides returns saved data when cache is fresh', () => {
    savePeriodOverrides({ '2024-01-01': { oneTimeBills: [], movedInBills: [], movedOutBillIds: [], billPaymentStatuses: {} } });
    expect(loadPeriodOverrides()).toEqual({ '2024-01-01': { oneTimeBills: [], movedInBills: [], movedOutBillIds: [], billPaymentStatuses: {} } });
  });

  it('loadPeriodOverrides returns empty object when cache is expired', () => {
    savePeriodOverrides({ '2024-01-01': { oneTimeBills: [], movedInBills: [], movedOutBillIds: [], billPaymentStatuses: {} } });
    localStorage.setItem(KEY_CACHE_TS, String(Date.now() - CACHE_TTL_MS - 1000));
    expect(loadPeriodOverrides()).toEqual({});
  });

  it('loadCreditCards returns saved data when cache is fresh', () => {
    saveCreditCards([{ id: 'card1', name: 'Visa', balanceCents: 5000 }]);
    expect(loadCreditCards()).toEqual([{ id: 'card1', name: 'Visa', balanceCents: 5000 }]);
  });

  it('loadCreditCards returns empty array when cache is expired', () => {
    saveCreditCards([{ id: 'card1', name: 'Visa', balanceCents: 5000 }]);
    localStorage.setItem(KEY_CACHE_TS, String(Date.now() - CACHE_TTL_MS - 1000));
    expect(loadCreditCards()).toEqual([]);
  });

  it('saving data refreshes the cache timestamp', () => {
    localStorage.setItem(KEY_CACHE_TS, String(Date.now() - CACHE_TTL_MS - 1000));
    saveBills([bill]);
    expect(isCacheValid()).toBe(true);
  });
});
