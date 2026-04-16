import type { Bill, PayPeriod, PaySettings } from '../domain/models';
import { generatePayPeriods } from '../domain/payPeriodGenerator';

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = (abs / 100).toFixed(2);
  return (cents < 0 ? '-$' : '$') + dollars;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function PeriodCard({ period }: { period: PayPeriod }) {
  return (
    <div className="card period-card">
      <div className="period-header">
        <span className="period-range">
          {formatDate(period.startDate)} – {formatDate(period.endDate)}
        </span>
        <span className="period-days">{period.daysInPeriod} days</span>
      </div>

      <table className="period-table">
        <tbody>
          <tr className="row-paycheck">
            <td>Paycheck</td>
            <td className="amount">{formatCents(period.paycheckAmountCents)}</td>
          </tr>

          {period.bills.map(({ bill, dueDate }) => (
            <tr key={bill.id} className="row-bill">
              <td>
                {bill.name}
                <span className="due-date"> (due {formatDate(dueDate)})</span>
              </td>
              <td className="amount neg">-{formatCents(bill.amountCents)}</td>
            </tr>
          ))}

          {period.hasSavings && (
            <tr className="row-savings">
              <td>Savings</td>
              <td className="amount pos">+{formatCents(period.savingsTotalCents)}</td>
            </tr>
          )}

          <tr className="row-divider">
            <td colSpan={2} />
          </tr>

          <tr className="row-remaining">
            <td>Remaining</td>
            <td className={`amount ${period.remainingCents < 0 ? 'neg' : 'pos'}`}>
              {formatCents(period.remainingCents)}
            </td>
          </tr>

          <tr className="row-spending">
            <td>Spending / day</td>
            <td className={`amount ${period.displayedSpendingPerDay < 0 ? 'neg' : ''}`}>
              {formatCents(period.displayedSpendingPerDay)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  bills: Bill[];
  settings: PaySettings | null;
}

export default function PayPeriodsPage({ bills, settings }: Props) {
  if (!settings) {
    return (
      <div className="empty-state">
        <p>No settings configured yet.</p>
        <p>Go to <strong>Settings</strong> to enter your paycheck details.</p>
      </div>
    );
  }

  const periods = generatePayPeriods(settings, bills);

  return (
    <div className="page">
      <h1 className="page-title">Pay Periods</h1>
      <div className="period-list">
        {periods.map((p) => (
          <PeriodCard key={p.startDate} period={p} />
        ))}
      </div>
    </div>
  );
}
