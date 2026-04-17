import type { Bill, CreditCard, PayPeriod } from '../domain/models';

// ── Sheets API value helpers ─────────────────────────────────────────────────

type CellValue = { userEnteredValue: { stringValue: string } | { numberValue: number } };
type RowData = { values: CellValue[] };

function toCell(value: string | number): CellValue {
  if (typeof value === 'number') {
    return { userEnteredValue: { numberValue: value } };
  }
  return { userEnteredValue: { stringValue: value } };
}

function toRow(values: (string | number)[]): RowData {
  return { values: values.map(toCell) };
}

function toHeaderRow(headers: string[]): RowData {
  return {
    values: headers.map((h) => ({
      userEnteredValue: { stringValue: h },
      userEnteredFormat: { textFormat: { bold: true } },
    })) as CellValue[],
  };
}

// ── Per-tab row builders ─────────────────────────────────────────────────────

export function buildPayPeriodsRows(periods: PayPeriod[]): RowData[] {
  const header = toHeaderRow([
    'Start Date', 'End Date', 'Paycheck ($)', 'Bills Total ($)',
    'Remaining ($)', 'Days', 'Spend/Day ($)', 'Surplus ($)',
  ]);
  const rows = periods.map((p) =>
    toRow([
      p.startDate,
      p.endDate,
      p.paycheckAmountCents / 100,
      p.billsTotalCents / 100,
      p.remainingCents / 100,
      p.daysInPeriod,
      p.displayedSpendingPerDay / 100,
      p.surplusCents / 100,
    ]),
  );
  return [header, ...rows];
}

export function buildBillsRows(bills: Bill[]): RowData[] {
  const header = toHeaderRow(['Name', 'Day of Month', 'Amount ($)']);
  const rows = bills.map((b) => toRow([b.name, b.dayOfMonth, b.amountCents / 100]));
  return [header, ...rows];
}

export function buildCreditCardsRows(cards: CreditCard[]): RowData[] {
  const header = toHeaderRow(['Name', 'Balance ($)', 'Transfer Expiry']);
  const rows = cards.map((c) =>
    toRow([c.name, c.balanceCents / 100, c.transferExpirationDate ?? '']),
  );
  return [header, ...rows];
}

// ── Main export function ─────────────────────────────────────────────────────

export interface SheetsExportData {
  bills: Bill[];
  creditCards: CreditCard[];
  periods: PayPeriod[];
}

/**
 * Creates a new Google Spreadsheet with three sheets (Pay Periods, Bills,
 * Credit Cards) populated with the provided data.
 *
 * @param accessToken A valid Google OAuth access token with the
 *   `https://www.googleapis.com/auth/spreadsheets` scope.
 * @returns The URL of the newly created spreadsheet.
 */
export async function exportToGoogleSheets(
  accessToken: string,
  data: SheetsExportData,
): Promise<string> {
  const dateLabel = new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  const body = {
    properties: { title: `Budget Export – ${dateLabel}` },
    sheets: [
      {
        properties: { title: 'Pay Periods' },
        data: [{ startRow: 0, startColumn: 0, rowData: buildPayPeriodsRows(data.periods) }],
      },
      {
        properties: { title: 'Bills' },
        data: [{ startRow: 0, startColumn: 0, rowData: buildBillsRows(data.bills) }],
      },
      {
        properties: { title: 'Credit Cards' },
        data: [{ startRow: 0, startColumn: 0, rowData: buildCreditCardsRows(data.creditCards) }],
      },
    ],
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Google Sheets access was denied. Please try again and grant the requested permission.');
    }
    throw new Error(`Could not create the spreadsheet (HTTP ${res.status}). Please try again.`);
  }

  const json = await res.json() as { spreadsheetId: string };
  return `https://docs.google.com/spreadsheets/d/${json.spreadsheetId}`;
}
