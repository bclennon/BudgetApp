import type { Bill, BillInPeriod, Frequency, PayPeriod, PaySettings } from './models';
import { resolveDueDate } from './billDueDateResolver';

function parseDate(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

function nextSemiMonthlyPayday(current: string): string {
  const { year, month, day } = parseDate(current);
  if (day === 15) {
    // On the 15th: next payday is the 30th of the same month (with overflow if needed)
    return resolveDueDate(year, month, 30);
  } else if (day > 15) {
    // On the 30th (or overflow): next payday is the 15th of next month
    const nm = month === 12 ? 1 : month + 1;
    const ny = month === 12 ? year + 1 : year;
    return `${ny}-${String(nm).padStart(2, '0')}-15`;
  } else {
    // day < 15: overflowed from previous 30th → next payday is 15th of current month
    return `${year}-${String(month).padStart(2, '0')}-15`;
  }
}

export function nextPayday(current: string, frequency: Frequency): string {
  const { year, month, day } = parseDate(current);
  switch (frequency) {
    case 'WEEKLY':
      return addDays(current, 7);
    case 'BIWEEKLY':
      return addDays(current, 14);
    case 'SEMI_MONTHLY':
      return nextSemiMonthlyPayday(current);
    case 'MONTHLY': {
      const nm = month === 12 ? 1 : month + 1;
      const ny = month === 12 ? year + 1 : year;
      return resolveDueDate(ny, nm, day);
    }
  }
}

export function generatePayPeriods(settings: PaySettings, bills: Bill[], count = 6): PayPeriod[] {
  const periods: PayPeriod[] = [];
  let currentStart = settings.nextPayday;

  for (let i = 0; i < count; i++) {
    const nextPay = nextPayday(currentStart, settings.frequency);
    const currentEnd = addDays(nextPay, -1);
    const daysInPeriod = daysBetween(currentStart, currentEnd) + 1;

    const startParts = parseDate(currentStart);
    const endParts = parseDate(currentEnd);
    const monthsToCheck: Array<{ year: number; month: number }> = [
      { year: startParts.year, month: startParts.month },
    ];
    if (startParts.year !== endParts.year || startParts.month !== endParts.month) {
      monthsToCheck.push({ year: endParts.year, month: endParts.month });
    }

    const billsInPeriod: BillInPeriod[] = [];
    for (const bill of bills) {
      for (const { year, month } of monthsToCheck) {
        const dueDate = resolveDueDate(year, month, bill.dayOfMonth);
        if (dueDate >= currentStart && dueDate <= currentEnd) {
          billsInPeriod.push({ bill, dueDate });
          break;
        }
      }
    }

    const billsTotalCents = billsInPeriod.reduce((sum, b) => sum + b.bill.amountCents, 0);
    const remainingCents = settings.paycheckAmountCents - billsTotalCents;
    const spendingPerDayRaw = daysInPeriod > 0 ? Math.trunc(remainingCents / daysInPeriod) : 0;
    const hasSavings = spendingPerDayRaw > settings.targetSpendingPerDayCents;
    const savingsTotalCents = hasSavings
      ? (spendingPerDayRaw - settings.targetSpendingPerDayCents) * daysInPeriod
      : 0;
    const displayedSpendingPerDay = hasSavings
      ? settings.targetSpendingPerDayCents
      : spendingPerDayRaw;

    periods.push({
      startDate: currentStart,
      endDate: currentEnd,
      bills: billsInPeriod,
      paycheckAmountCents: settings.paycheckAmountCents,
      billsTotalCents,
      remainingCents,
      daysInPeriod,
      spendingPerDayRaw,
      displayedSpendingPerDay,
      savingsTotalCents,
      hasSavings,
    });

    currentStart = nextPay;
  }

  return periods;
}
