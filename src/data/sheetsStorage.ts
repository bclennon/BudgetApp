import type { Bill, CreditCard, PaySettings, PeriodOverrides } from '../domain/models';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

const SHEET_BILLS = 'Bills';
const SHEET_SETTINGS = 'Settings';
const SHEET_OVERRIDES = 'PeriodOverrides';
const SHEET_CARDS = 'CreditCards';

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
    if (res.status === 404) return null;
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
  const [bills, settings, periodOverrides, creditCards] = await Promise.all([
    readSheetValue<Bill[]>(token, spreadsheetId, SHEET_BILLS),
    readSheetValue<PaySettings>(token, spreadsheetId, SHEET_SETTINGS),
    readSheetValue<PeriodOverrides>(token, spreadsheetId, SHEET_OVERRIDES),
    readSheetValue<CreditCard[]>(token, spreadsheetId, SHEET_CARDS),
  ]);
  return { bills, settings, periodOverrides, creditCards };
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
