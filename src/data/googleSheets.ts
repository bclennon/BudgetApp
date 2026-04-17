import type { Bill, BillInPeriod, CreditCard, PayPeriod, PeriodOverrides } from '../domain/models';
import { getPlannedCardPayments } from '../domain/models';

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = (abs / 100).toFixed(2);
  return (cents < 0 ? '-$' : '$') + dollars;
}

function formatDateStr(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── Sheets API value helpers ─────────────────────────────────────────────────

type CellColor = { red: number; green: number; blue: number };
type CellFormat = {
  textFormat?: { bold?: boolean };
  backgroundColor?: CellColor;
  horizontalAlignment?: string;
};
type CellValue = {
  userEnteredValue: { stringValue: string } | { numberValue: number };
  userEnteredFormat?: CellFormat;
};
type RowData = { values: CellValue[] };

const PERIOD_HEADER_BG: CellColor = { red: 0.75, green: 0.84, blue: 0.94 };
const REMAINING_POS_BG: CellColor = { red: 0.85, green: 0.93, blue: 0.83 };
const REMAINING_NEG_BG: CellColor = { red: 0.96, green: 0.80, blue: 0.80 };

function textCell(value: string, fmt?: CellFormat): CellValue {
  return { userEnteredValue: { stringValue: value }, ...(fmt ? { userEnteredFormat: fmt } : {}) };
}

function boldCell(value: string, bg?: CellColor, horizontalAlignment?: string): CellValue {
  return textCell(value, {
    textFormat: { bold: true },
    ...(bg ? { backgroundColor: bg } : {}),
    ...(horizontalAlignment ? { horizontalAlignment } : {}),
  });
}

function effectiveBillCents(bip: BillInPeriod): number {
  return bip.amountOverrideCents ?? bip.bill.amountCents;
}

function emptyRow(): RowData {
  return { values: [textCell(''), textCell('')] };
}

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

function billLabel(bip: BillInPeriod): string {
  let name = `${bip.bill.name} (due ${formatDateStr(bip.dueDate)})`;
  if (bip.movedFromPeriod) name += ' ↔ moved';
  if (bip.isOneTime) name += ' ✦ one-time';
  return name;
}

/**
 * Builds the "Pay Periods" sheet rows, with one detailed block per period
 * that mirrors the web page layout: paycheck, bills, credit card payments,
 * totals, remaining, and spending per day.
 */
export function buildPayPeriodsSheet(
  periods: PayPeriod[],
  creditCards: CreditCard[],
  periodOverrides: PeriodOverrides,
): RowData[] {
  const rows: RowData[] = [];
  let runningCards = creditCards;

  for (const period of periods) {
    const override = periodOverrides[period.startDate];

    // Compute planned CC payments using running adjusted balances (same logic as PayPeriodsPage)
    const ccStatuses = override?.creditCardPaymentStatuses;
    const legacyCcProcessed = !ccStatuses && override?.creditCardPaymentStatus === 'processed';
    const availableCents = period.hasSurplus ? period.surplusCents : 0;
    const plannedPayments = getPlannedCardPayments(availableCents, runningCards);

    // Advance running balances for subsequent periods
    if (!legacyCcProcessed && plannedPayments.length > 0) {
      const paymentMap = new Map(plannedPayments.map((p) => [p.card.id, p.amountCents]));
      runningCards = runningCards.map((c) => {
        const planned = paymentMap.get(c.id);
        if (!planned) return c;
        if (ccStatuses?.[c.id] === 'processed') return c;
        return { ...c, balanceCents: Math.max(0, c.balanceCents - planned) };
      });
    }

    // Period header: "Apr 18, 2025 – May 1, 2025"  |  "14 days"
    const dateRange = `${formatDateStr(period.startDate)} – ${formatDateStr(period.endDate)}`;
    rows.push({
      values: [
        boldCell(dateRange, PERIOD_HEADER_BG),
        boldCell(`${period.daysInPeriod} days`, PERIOD_HEADER_BG, 'RIGHT'),
      ],
    });

    // Paycheck
    rows.push({ values: [textCell('Paycheck'), textCell(formatCents(period.paycheckAmountCents))] });

    // Individual bill rows
    for (const bip of period.bills) {
      rows.push({ values: [textCell(`  ${billLabel(bip)}`), textCell(`-${formatCents(effectiveBillCents(bip))}`)] });
    }

    // Credit card payment rows
    for (const { card, amountCents } of plannedPayments) {
      let name = `  → ${card.name}`;
      if (card.transferExpirationDate) name += ` (exp. ${card.transferExpirationDate})`;
      rows.push({ values: [textCell(name), textCell(`-${formatCents(amountCents)}`)] });
    }

    // Empty divider
    rows.push(emptyRow());

    // Bills Total (sum of all displayed bills, regardless of payment status)
    const billsTotal = period.bills.reduce((sum, bip) => sum + effectiveBillCents(bip), 0);
    rows.push({ values: [textCell('Bills Total'), textCell(`-${formatCents(billsTotal)}`)] });

    // Remaining = paycheck − bills − CC payments
    const totalCCCents = plannedPayments.reduce((s, p) => s + p.amountCents, 0);
    const remaining = period.paycheckAmountCents - billsTotal - totalCCCents;
    const remainingBg = remaining < 0 ? REMAINING_NEG_BG : REMAINING_POS_BG;
    rows.push({ values: [boldCell('Remaining', remainingBg), boldCell(formatCents(remaining), remainingBg)] });

    // Spending / day
    const spendPerDay = period.daysInPeriod > 0 ? Math.trunc(remaining / period.daysInPeriod) : 0;
    rows.push({ values: [boldCell('Spending / day'), boldCell(formatCents(spendPerDay))] });

    // Blank row between periods
    rows.push(emptyRow());
  }

  return rows;
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
  periodOverrides: PeriodOverrides;
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
        data: [{ startRow: 0, startColumn: 0, rowData: buildPayPeriodsSheet(data.periods, data.creditCards, data.periodOverrides) }],
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
