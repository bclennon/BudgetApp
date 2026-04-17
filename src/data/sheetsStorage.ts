import type { Bill, CreditCard, PaySettings, PeriodOverrides } from '../domain/models';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

const SHEET_BILLS = 'Bills';
const SHEET_SETTINGS = 'Settings';
const SHEET_OVERRIDES = 'PeriodOverrides';
const SHEET_CARDS = 'CreditCards';

// ── Custom errors ─────────────────────────────────────────────────────────────

/** Thrown when the spreadsheet ID is no longer valid (e.g. the spreadsheet was deleted). */
export class SpreadsheetNotFoundError extends Error {
  constructor(spreadsheetId: string) {
    super(`Spreadsheet not found (id: ${spreadsheetId})`);
    this.name = 'SpreadsheetNotFoundError';
  }
}

/** Thrown when a specific sheet tab does not exist within the spreadsheet. */
export class SheetTabNotFoundError extends Error {
  readonly tabName: string;
  constructor(tabName: string) {
    super(`Sheet tab "${tabName}" not found in spreadsheet.`);
    this.name = 'SheetTabNotFoundError';
    this.tabName = tabName;
  }
}

/** Thrown by {@link loadAllFromSheets} when one or more expected sheet tabs are missing. */
export class SheetTabsNotFoundError extends Error {
  readonly missingTabs: string[];
  constructor(missingTabs: string[]) {
    super(`Missing sheet tabs: ${missingTabs.join(', ')}`);
    this.name = 'SheetTabsNotFoundError';
    this.missingTabs = missingTabs;
  }
}

const SPREADSHEET_TITLE = 'BudgetApp Data';

// ── Spreadsheet ID persistence ────────────────────────────────────────────────

function spreadsheetIdKey(uid: string): string {
  return `budgetapp_sheets_id_${uid}`;
}

export function getStoredSpreadsheetId(uid: string): string | null {
  return localStorage.getItem(spreadsheetIdKey(uid));
}

function storeSpreadsheetId(uid: string, id: string): void {
  localStorage.setItem(spreadsheetIdKey(uid), id);
}

export function clearStoredSpreadsheetId(uid: string): void {
  localStorage.removeItem(spreadsheetIdKey(uid));
}

// ── Sheets API helpers ────────────────────────────────────────────────────────

async function sheetsRequest(
  method: string,
  url: string,
  token: string,
  body?: unknown,
): Promise<Response> {
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// ── Spreadsheet creation ──────────────────────────────────────────────────────

async function createDataSpreadsheet(token: string): Promise<string> {
  const body = {
    properties: { title: SPREADSHEET_TITLE },
    sheets: [
      { properties: { title: SHEET_BILLS } },
      { properties: { title: SHEET_SETTINGS } },
      { properties: { title: SHEET_OVERRIDES } },
      { properties: { title: SHEET_CARDS } },
    ],
  };
  const res = await sheetsRequest('POST', SHEETS_BASE, token, body);
  if (!res.ok) {
    throw new Error(`Failed to create spreadsheet (HTTP ${res.status}).`);
  }
  const json = (await res.json()) as { spreadsheetId: string };
  return json.spreadsheetId;
}

/**
 * Searches Google Drive for an existing spreadsheet with the app's title.
 * Returns the ID of the first match, or null if none is found.
 */
async function findExistingSpreadsheet(token: string): Promise<string | null> {
  const escapedTitle = SPREADSHEET_TITLE.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const query = encodeURIComponent(
    `name='${escapedTitle}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)&pageSize=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error(`Drive file search failed (HTTP ${res.status}); will create a new spreadsheet.`);
    return null;
  }
  const json = (await res.json()) as { files?: { id: string }[] };
  return json.files?.[0]?.id ?? null;
}

/**
 * Returns the spreadsheet ID for this user's data store. Looks up the ID in
 * this order: localStorage cache → existing Drive file → newly created file.
 * This prevents duplicate spreadsheets when localStorage is cleared or the app
 * is opened on a new device.
 */
export async function getOrCreateSpreadsheet(token: string, uid: string): Promise<string> {
  const stored = getStoredSpreadsheetId(uid);
  if (stored) return stored;
  const existing = await findExistingSpreadsheet(token);
  const id = existing ?? (await createDataSpreadsheet(token));
  storeSpreadsheetId(uid, id);
  return id;
}

/**
 * Looks up the spreadsheet ID for this user without creating a new one.
 * Checks the localStorage cache first, then searches Google Drive.
 * Returns the ID if found, or null if no matching spreadsheet exists.
 */
export async function findSpreadsheetId(token: string, uid: string): Promise<string | null> {
  const stored = getStoredSpreadsheetId(uid);
  if (stored) return stored;
  const existing = await findExistingSpreadsheet(token);
  if (existing) storeSpreadsheetId(uid, existing);
  return existing;
}

/**
 * Creates a new BudgetApp Data spreadsheet, caches its ID in localStorage,
 * and returns the ID.
 */
export async function createNewSpreadsheet(token: string, uid: string): Promise<string> {
  const id = await createDataSpreadsheet(token);
  storeSpreadsheetId(uid, id);
  return id;
}

// ── Low-level cell read/write ─────────────────────────────────────────────────

async function readSheetValue<T>(
  token: string,
  spreadsheetId: string,
  sheetName: string,
): Promise<T | null> {
  const range = encodeURIComponent(`${sheetName}!A1`);
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${range}`;
  const res = await sheetsRequest('GET', url, token);
  if (!res.ok) {
    if (res.status === 404) throw new SpreadsheetNotFoundError(spreadsheetId);
    // HTTP 400 from the values endpoint means the sheet tab does not exist.
    if (res.status === 400) throw new SheetTabNotFoundError(sheetName);
    throw new Error(`Failed to read sheet "${sheetName}" (HTTP ${res.status}).`);
  }
  const json = (await res.json()) as { values?: string[][] };
  const raw = json.values?.[0]?.[0];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeSheetValue<T>(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  data: T,
): Promise<void> {
  const range = encodeURIComponent(`${sheetName}!A1`);
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${range}?valueInputOption=RAW`;
  const body = { values: [[JSON.stringify(data)]] };
  const res = await sheetsRequest('PUT', url, token, body);
  if (!res.ok) {
    throw new Error(`Failed to write to sheet "${sheetName}" (HTTP ${res.status}).`);
  }
}

// ── Public load / save API ────────────────────────────────────────────────────

export interface SheetsData {
  bills: Bill[] | null;
  settings: PaySettings | null;
  periodOverrides: PeriodOverrides | null;
  creditCards: CreditCard[] | null;
}

/** Loads all four data types from the spreadsheet in parallel. */
export async function loadAllFromSheets(
  token: string,
  spreadsheetId: string,
): Promise<SheetsData> {
  const results = await Promise.allSettled([
    readSheetValue<Bill[]>(token, spreadsheetId, SHEET_BILLS),
    readSheetValue<PaySettings>(token, spreadsheetId, SHEET_SETTINGS),
    readSheetValue<PeriodOverrides>(token, spreadsheetId, SHEET_OVERRIDES),
    readSheetValue<CreditCard[]>(token, spreadsheetId, SHEET_CARDS),
  ]);

  // Collect missing-tab errors. Any other rejection is re-thrown immediately.
  const missingTabs: string[] = [];
  for (const result of results) {
    if (result.status === 'rejected') {
      if (result.reason instanceof SheetTabNotFoundError) {
        missingTabs.push(result.reason.tabName);
      } else {
        throw result.reason;
      }
    }
  }
  if (missingTabs.length > 0) {
    throw new SheetTabsNotFoundError(missingTabs);
  }

  const [billsR, settingsR, overridesR, cardsR] = results;
  return {
    bills: billsR.status === 'fulfilled' ? billsR.value : null,
    settings: settingsR.status === 'fulfilled' ? settingsR.value : null,
    periodOverrides: overridesR.status === 'fulfilled' ? overridesR.value : null,
    creditCards: cardsR.status === 'fulfilled' ? cardsR.value : null,
  };
}

/**
 * Adds one or more sheet tabs to an existing spreadsheet using the batchUpdate
 * API. Used to repair a spreadsheet that is missing expected tabs.
 */
export async function addSheetTabsToSpreadsheet(
  token: string,
  spreadsheetId: string,
  tabNames: string[],
): Promise<void> {
  const requests = tabNames.map((title) => ({ addSheet: { properties: { title } } }));
  const url = `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`;
  const res = await sheetsRequest('POST', url, token, { requests });
  if (!res.ok) {
    throw new Error(`Failed to add sheet tabs (HTTP ${res.status}).`);
  }
}

export async function saveBillsToSheets(
  token: string,
  spreadsheetId: string,
  bills: Bill[],
): Promise<void> {
  await writeSheetValue(token, spreadsheetId, SHEET_BILLS, bills);
}

export async function saveSettingsToSheets(
  token: string,
  spreadsheetId: string,
  settings: PaySettings,
): Promise<void> {
  await writeSheetValue(token, spreadsheetId, SHEET_SETTINGS, settings);
}

export async function savePeriodOverridesToSheets(
  token: string,
  spreadsheetId: string,
  overrides: PeriodOverrides,
): Promise<void> {
  await writeSheetValue(token, spreadsheetId, SHEET_OVERRIDES, overrides);
}

export async function saveCreditCardsToSheets(
  token: string,
  spreadsheetId: string,
  cards: CreditCard[],
): Promise<void> {
  await writeSheetValue(token, spreadsheetId, SHEET_CARDS, cards);
}
