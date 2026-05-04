import { useMemo } from 'react';
import type { Bill, CreditCard, CreditCardPayment, PayPeriod, PaySettings, PeriodOverrides, PayPeriodOverride } from '../domain/models';
import { emptyOverride, getPlannedCardPayments } from '../domain/models';
import { generatePayPeriods, daysBetween } from '../domain/payPeriodGenerator';
import { PeriodCard } from './PayPeriodsPage';

interface Props {
  bills: Bill[];
  settings: PaySettings | null;
  overrides: PeriodOverrides;
  creditCards: CreditCard[];
  onUpdatePeriodOverride: (periodStart: string, patch: Partial<PayPeriodOverride>) => void;
  onMoveBill: (billId: number, fromPeriodStart: string, toPeriodStart: string, toDueDate: string) => void;
  onUnmoveBill: (billId: number, fromPeriodStart: string, toPeriodStart: string) => void;
  onCreditCardPaymentProcessed: (periodStart: string, payments: CreditCardPayment[]) => void;
  onCreditCardPaymentRestored: (periodStart: string, payments: CreditCardPayment[]) => void;
  onUnarchivePeriod: (periodStart: string) => void;
}

export default function ArchivedPeriodsPage({
  bills,
  settings,
  overrides,
  creditCards,
  onUpdatePeriodOverride,
  onMoveBill,
  onUnmoveBill,
  onCreditCardPaymentProcessed,
  onCreditCardPaymentRestored,
  onUnarchivePeriod,
}: Props) {
  if (!settings) {
    return (
      <div className="empty-state">
        <p>No settings configured yet.</p>
        <p>Go to <strong>Settings</strong> to enter your paycheck details.</p>
      </div>
    );
  }

  const todayDate = new Date();
  const today = todayDate.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

  // Find all archived period startDates from overrides.
  const archivedStartDates = Object.keys(overrides).filter((d) => overrides[d].archived === true);

  // Generate periods starting from the earliest archived date so that all
  // archived periods appear in the list regardless of the current nextPayday.
  // A count of 200 covers many years of periods at any frequency.
  const archivedPeriods: PayPeriod[] = useMemo(() => {
    if (archivedStartDates.length === 0) return [];
    const earliest = [...archivedStartDates].sort()[0];
    const startSettings = { ...settings, nextPayday: earliest };
    const allPeriods = generatePayPeriods(startSettings, bills, 200, overrides);
    return allPeriods.filter((p) => overrides[p.startDate]?.archived === true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, bills, overrides]);

  if (archivedPeriods.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Archived Pay Periods</h1>
        </div>
        <div className="empty-state">
          <p>No archived pay periods yet.</p>
          <p>Use the <strong>📦 Archive</strong> button on a past pay period to move it here.</p>
        </div>
      </div>
    );
  }

  // Compute per-period adjusted credit card balances for archived periods.
  const periodsWithCards = useMemo(() => {
    const result: { period: PayPeriod; adjustedCards: CreditCard[] }[] = [];
    let runningCards = creditCards;
    for (const period of archivedPeriods) {
      const adjustedCards = runningCards;
      const override = overrides[period.startDate];
      const ccStatuses = override?.creditCardPaymentStatuses;
      const legacyCcProcessed = !ccStatuses && override?.creditCardPaymentStatus === 'processed';

      if (!legacyCcProcessed) {
        const isCurrentPeriod = today >= period.startDate && today <= period.endDate;
        const remainingDays = isCurrentPeriod
          ? daysBetween(today, period.endDate) + 1
          : period.daysInPeriod;
        const effectiveDays = Math.max(1, remainingDays);
        const plannedAmount = settings.minSpendPerDayCents > 0
          ? Math.max(0, period.remainingCents - settings.minSpendPerDayCents * effectiveDays)
          : (period.hasSurplus ? period.surplusCents : 0);
        const payments = getPlannedCardPayments(plannedAmount, adjustedCards);
        if (payments.length > 0) {
          const paymentMap = new Map(payments.map((p) => [p.card.id, p.amountCents]));
          runningCards = runningCards.map((c) => {
            const planned = paymentMap.get(c.id);
            if (!planned) return c;
            if (ccStatuses?.[c.id] === 'processed') return c;
            return { ...c, balanceCents: Math.max(0, c.balanceCents - planned) };
          });
        }
      }
      result.push({ period, adjustedCards });
    }
    return result;
  }, [archivedPeriods, creditCards, overrides, today, settings.minSpendPerDayCents]);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Archived Pay Periods</h1>
      </div>
      <div className="period-list">
        {periodsWithCards.map(({ period, adjustedCards }) => (
          <PeriodCard
            key={period.startDate}
            period={period}
            allPeriods={archivedPeriods}
            allBills={bills}
            override={overrides[period.startDate] ?? emptyOverride()}
            defaultPaycheckCents={settings.paycheckAmountCents}
            creditCards={adjustedCards}
            today={today}
            minSpendPerDayCents={settings.minSpendPerDayCents}
            onUpdateOverride={(patch) => onUpdatePeriodOverride(period.startDate, patch)}
            onMoveBill={(billId, toPeriodStart, toDueDate) =>
              onMoveBill(billId, period.startDate, toPeriodStart, toDueDate)
            }
            onUnmoveBill={(billId, fromPeriodStart) =>
              onUnmoveBill(billId, fromPeriodStart, period.startDate)
            }
            onCreditCardPaymentProcessed={(payments) =>
              onCreditCardPaymentProcessed(period.startDate, payments)
            }
            onCreditCardPaymentRestored={(payments) =>
              onCreditCardPaymentRestored(period.startDate, payments)
            }
            onUnarchive={() => onUnarchivePeriod(period.startDate)}
          />
        ))}
      </div>
    </div>
  );
}
