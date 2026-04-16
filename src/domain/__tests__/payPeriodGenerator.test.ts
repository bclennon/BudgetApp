import { describe, it, expect } from 'vitest';
import { generatePayPeriods } from '../payPeriodGenerator';
import type { Bill, PaySettings, PeriodOverrides } from '../models';

function makeSettings(
  nextPayday: string,
  frequency: PaySettings['frequency'],
  paycheckCents = 300000,
  minSpendPerDayCents = 0
): PaySettings {
  return { paycheckAmountCents: paycheckCents, frequency, nextPayday, minSpendPerDayCents };
}

describe('generatePayPeriods', () => {
  it('weekly 3 periods from 2024-01-01', () => {
    const periods = generatePayPeriods(makeSettings('2024-01-01', 'WEEKLY'), [], 3);
    expect(periods).toHaveLength(3);
    expect(periods[0].startDate).toBe('2024-01-01');
    expect(periods[0].endDate).toBe('2024-01-07');
    expect(periods[1].startDate).toBe('2024-01-08');
    expect(periods[1].endDate).toBe('2024-01-14');
    expect(periods[2].startDate).toBe('2024-01-15');
    expect(periods[2].endDate).toBe('2024-01-21');
  });

  it('biweekly 3 periods from 2024-01-01', () => {
    const periods = generatePayPeriods(makeSettings('2024-01-01', 'BIWEEKLY'), [], 3);
    expect(periods).toHaveLength(3);
    expect(periods[0].startDate).toBe('2024-01-01');
    expect(periods[0].endDate).toBe('2024-01-14');
    expect(periods[1].startDate).toBe('2024-01-15');
    expect(periods[1].endDate).toBe('2024-01-28');
    expect(periods[2].startDate).toBe('2024-01-29');
    expect(periods[2].endDate).toBe('2024-02-11');
  });

  it('semi-monthly 4 periods from 2024-01-15', () => {
    const periods = generatePayPeriods(makeSettings('2024-01-15', 'SEMI_MONTHLY'), [], 4);
    expect(periods).toHaveLength(4);
    expect(periods[0].startDate).toBe('2024-01-15');
    expect(periods[0].endDate).toBe('2024-01-29');
    expect(periods[1].startDate).toBe('2024-01-30');
    expect(periods[1].endDate).toBe('2024-02-14');
    expect(periods[2].startDate).toBe('2024-02-15');
    expect(periods[2].endDate).toBe('2024-02-29');
    expect(periods[3].startDate).toBe('2024-03-01');
    expect(periods[3].endDate).toBe('2024-03-14');
  });

  it('monthly 3 periods from 2024-01-31', () => {
    const periods = generatePayPeriods(makeSettings('2024-01-31', 'MONTHLY'), [], 3);
    expect(periods).toHaveLength(3);
    expect(periods[0].startDate).toBe('2024-01-31');
    expect(periods[1].startDate).toBe('2024-03-02');
    expect(periods[2].startDate).toBe('2024-04-02');
  });

  it('processed bills are excluded from billsTotalCents and remainingCents', () => {
    const bills: Bill[] = [
      { id: 1, name: 'Rent', dayOfMonth: 5, amountCents: 100000 },
      { id: 2, name: 'Electric', dayOfMonth: 10, amountCents: 5000 },
    ];
    const settings = makeSettings('2024-01-01', 'MONTHLY', 200000);
    // Mark bill 1 (Rent) as processed
    const overrides: PeriodOverrides = {
      '2024-01-01': {
        oneTimeBills: [],
        movedInBills: [],
        movedOutBillIds: [],
        billPaymentStatuses: { '1': 'processed' },
      },
    };
    const periods = generatePayPeriods(settings, bills, 1, overrides);
    // Only Electric ($50) should be counted; Rent ($1000) is excluded
    expect(periods[0].billsTotalCents).toBe(5000);
    expect(periods[0].remainingCents).toBe(200000 - 5000);
  });

  it('submitted bills are still included in billsTotalCents', () => {
    const bills: Bill[] = [
      { id: 1, name: 'Rent', dayOfMonth: 5, amountCents: 100000 },
    ];
    const settings = makeSettings('2024-01-01', 'MONTHLY', 200000);
    const overrides: PeriodOverrides = {
      '2024-01-01': {
        oneTimeBills: [],
        movedInBills: [],
        movedOutBillIds: [],
        billPaymentStatuses: { '1': 'submitted' },
      },
    };
    const periods = generatePayPeriods(settings, bills, 1, overrides);
    expect(periods[0].billsTotalCents).toBe(100000);
    expect(periods[0].remainingCents).toBe(100000);
  });

  it('processed one-time bills are excluded from billsTotalCents', () => {
    const settings = makeSettings('2024-01-01', 'MONTHLY', 200000);
    const overrides: PeriodOverrides = {
      '2024-01-01': {
        oneTimeBills: [
          { id: 'ot-abc', name: 'Car repair', amountCents: 30000, dueDate: '2024-01-15' },
        ],
        movedInBills: [],
        movedOutBillIds: [],
        billPaymentStatuses: { 'ot-abc': 'processed' },
      },
    };
    const periods = generatePayPeriods(settings, [], 1, overrides);
    expect(periods[0].billsTotalCents).toBe(0);
    expect(periods[0].remainingCents).toBe(200000);
  });

  it('surplus is zero when minSpendPerDayCents is 0', () => {
    // Paycheck $3000, no bills, 31-day month → spendingPerDayRaw = floor(300000/31) = 9677
    const settings = makeSettings('2024-01-01', 'MONTHLY', 300000, 0);
    const periods = generatePayPeriods(settings, [], 1);
    expect(periods[0].hasSurplus).toBe(false);
    expect(periods[0].surplusCents).toBe(0);
    expect(periods[0].displayedSpendingPerDay).toBe(periods[0].spendingPerDayRaw);
  });

  it('surplus is computed when minSpendPerDayCents is below spendingPerDayRaw', () => {
    // Paycheck $3100, no bills, 31-day period (MONTHLY from Jan 1)
    // spendingPerDayRaw = floor(310000 / 31) = 10000
    // minSpendPerDay = 5000, surplus = (10000 - 5000) * 31 = 155000
    const settings = makeSettings('2024-01-01', 'MONTHLY', 310000, 5000);
    const periods = generatePayPeriods(settings, [], 1);
    expect(periods[0].hasSurplus).toBe(true);
    expect(periods[0].displayedSpendingPerDay).toBe(5000);
    expect(periods[0].surplusCents).toBe((10000 - 5000) * periods[0].daysInPeriod);
  });

  it('no surplus when spendingPerDayRaw is at or below minSpendPerDayCents', () => {
    // Paycheck $1000, no bills, 31-day month → spendingPerDayRaw = floor(100000/31) = 3225
    // minSpendPerDay = 5000 → spendingPerDayRaw < min, so no surplus
    const settings = makeSettings('2024-01-01', 'MONTHLY', 100000, 5000);
    const periods = generatePayPeriods(settings, [], 1);
    expect(periods[0].hasSurplus).toBe(false);
    expect(periods[0].surplusCents).toBe(0);
    expect(periods[0].displayedSpendingPerDay).toBe(periods[0].spendingPerDayRaw);
  });
});
