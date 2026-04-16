import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import type { Bill, PayPeriod, PaySettings, PeriodOverrides, PayPeriodOverride, BillPaymentStatus } from '../domain/models';
import { emptyOverride } from '../domain/models';
import { generatePayPeriods } from '../domain/payPeriodGenerator';
import { resolveDueDate } from '../domain/billDueDateResolver';

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

function dollarsToStr(cents: number): string {
  return (cents / 100).toFixed(2);
}

function strToCents(value: string): number {
  return Math.round(parseFloat(value) * 100);
}

function uniqueId(): string {
  return crypto.randomUUID();
}

function parseCents(value: string): number | null {
  const cents = strToCents(value);
  return isNaN(cents) || cents <= 0 ? null : cents;
}

/** Compute the best due date for a bill when moved into a target period. */
function computeMoveDueDate(bill: Bill, targetStart: string, targetEnd: string): string {
  const [sy, sm] = targetStart.split('-').map(Number);
  const [ey, em] = targetEnd.split('-').map(Number);
  // Try the bill's dayOfMonth in the start month
  const d1 = resolveDueDate(sy, sm, bill.dayOfMonth);
  if (d1 >= targetStart && d1 <= targetEnd) return d1;
  // Try end month if different
  if (sy !== ey || sm !== em) {
    const d2 = resolveDueDate(ey, em, bill.dayOfMonth);
    if (d2 >= targetStart && d2 <= targetEnd) return d2;
  }
  // Fallback to start of target period
  return targetStart;
}

// ── Paycheck edit row ──────────────────────────────────────────────────────

interface PaycheckEditProps {
  currentCents: number;
  defaultCents: number;
  isOverridden: boolean;
  onSave: (cents: number | undefined) => void;
  onCancel: () => void;
}

function PaycheckEditRow({ currentCents, defaultCents, isOverridden, onSave, onCancel }: PaycheckEditProps) {
  const [value, setValue] = useState(dollarsToStr(currentCents));
  const [error, setError] = useState('');

  function handleSave() {
    const cents = parseCents(value);
    if (cents === null) { setError('Enter a valid amount.'); return; }
    onSave(cents);
  }

  function handleReset() {
    onSave(undefined); // clear override
  }

  return (
    <tr className="row-paycheck-edit">
      <td colSpan={2}>
        <div className="period-inline-form">
          {error && <span className="inline-error">{error}</span>}
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="inline-input"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          />
          <button className="btn-xs btn-primary-xs" onClick={handleSave}>Save</button>
          {isOverridden && (
            <button className="btn-xs" onClick={handleReset} title={`Reset to ${formatCents(defaultCents)}`}>Reset</button>
          )}
          <button className="btn-xs" onClick={onCancel}>✕</button>
        </div>
      </td>
    </tr>
  );
}

// ── Move bill row ──────────────────────────────────────────────────────────

interface MoveSelectorProps {
  allPeriods: PayPeriod[];
  currentPeriodStart: string;
  onMove: (toPeriodStart: string, toDueDate: string) => void;
  onCancel: () => void;
  bill: Bill;
}

function MoveSelectorRow({ allPeriods, currentPeriodStart, onMove, onCancel, bill }: MoveSelectorProps) {
  const options = allPeriods.filter((p) => p.startDate !== currentPeriodStart);
  const [selected, setSelected] = useState(options[0]?.startDate ?? '');

  function handleMove() {
    if (!selected) return;
    const target = allPeriods.find((p) => p.startDate === selected)!;
    const dueDate = computeMoveDueDate(bill, target.startDate, target.endDate);
    onMove(selected, dueDate);
  }

  return (
    <tr className="row-move-selector">
      <td colSpan={2}>
        <div className="period-inline-form">
          <span className="inline-label">Move to:</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="inline-select"
          >
            {options.map((p) => (
              <option key={p.startDate} value={p.startDate}>
                {formatDate(p.startDate)} – {formatDate(p.endDate)}
              </option>
            ))}
          </select>
          <button className="btn-xs btn-primary-xs" onClick={handleMove}>Move</button>
          <button className="btn-xs" onClick={onCancel}>✕</button>
        </div>
      </td>
    </tr>
  );
}

// ── Add one-time bill form ─────────────────────────────────────────────────

interface AddOneTimeBillProps {
  periodStart: string;
  periodEnd: string;
  onAdd: (name: string, amountCents: number, dueDate: string) => void;
  onCancel: () => void;
}

function AddOneTimeBillRow({ periodStart, periodEnd, onAdd, onCancel }: AddOneTimeBillProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(periodStart);
  const [error, setError] = useState('');

  function handleAdd() {
    if (!name.trim()) { setError('Name required.'); return; }
    const cents = parseCents(amount);
    if (cents === null) { setError('Enter a valid amount.'); return; }
    if (dueDate < periodStart || dueDate > periodEnd) { setError('Date must be within this period.'); return; }
    onAdd(name.trim(), cents, dueDate);
  }

  return (
    <tr className="row-add-one-time-form">
      <td colSpan={2}>
        <div className="period-inline-form period-inline-form--stacked">
          {error && <span className="inline-error">{error}</span>}
          <div className="period-inline-form">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bill name"
              className="inline-input inline-input--flex"
              autoFocus
            />
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="inline-input inline-input--amount"
            />
            <input
              type="date"
              value={dueDate}
              min={periodStart}
              max={periodEnd}
              onChange={(e) => setDueDate(e.target.value)}
              className="inline-input inline-input--date"
            />
            <button className="btn-xs btn-primary-xs" onClick={handleAdd}>Add</button>
            <button className="btn-xs" onClick={onCancel}>✕</button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Payment status helpers ─────────────────────────────────────────────────

function nextPaymentStatus(current: BillPaymentStatus | undefined): BillPaymentStatus | undefined {
  if (!current) return 'submitted';
  if (current === 'submitted') return 'processed';
  return undefined;
}

function paymentStatusIcon(status: BillPaymentStatus | undefined): string {
  if (status === 'submitted') return '⏳';
  if (status === 'processed') return '✓';
  return '○';
}

function paymentStatusTitle(status: BillPaymentStatus | undefined): string {
  if (status === 'submitted') return 'Payment submitted – click to mark as processed';
  if (status === 'processed') return 'Payment processed – click to clear';
  return 'Mark as payment submitted';
}

function paymentStatusClassName(status: BillPaymentStatus | undefined): string {
  return `btn-xs btn-inline btn-payment-status${status ? ` btn-payment-${status}` : ''}`;
}

function billKey(billId: number): string {
  return String(billId);
}

// ── Period card ────────────────────────────────────────────────────────────

interface PeriodCardProps {
  period: PayPeriod;
  allPeriods: PayPeriod[];
  override: PayPeriodOverride;
  defaultPaycheckCents: number;
  isCurrentPeriod: boolean;
  plaidLinked: boolean;
  onUpdateOverride: (patch: Partial<PayPeriodOverride>) => void;
  onMoveBill: (billId: number, toPeriodStart: string, toDueDate: string) => void;
  onUnmoveBill: (billId: number, fromPeriodStart: string) => void;
}

function PeriodCard({
  period,
  allPeriods,
  override,
  defaultPaycheckCents,
  isCurrentPeriod,
  plaidLinked,
  onUpdateOverride,
  onMoveBill,
  onUnmoveBill,
}: PeriodCardProps) {
  const [editingPaycheck, setEditingPaycheck] = useState(false);
  const [movingBillId, setMovingBillId] = useState<number | null>(null);
  const [addingOneTime, setAddingOneTime] = useState(false);
  const [fetchingBalance, setFetchingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState('');

  const isPaycheckOverridden = override.paycheckAmountCents !== undefined;

  function handleSavePaycheck(cents: number | undefined) {
    onUpdateOverride({ paycheckAmountCents: cents });
    setEditingPaycheck(false);
  }

  function handleMoveConfirm(billId: number, toPeriodStart: string, toDueDate: string) {
    onMoveBill(billId, toPeriodStart, toDueDate);
    setMovingBillId(null);
  }

  function handleAddOneTime(name: string, amountCents: number, dueDate: string) {
    const newBill = { id: uniqueId(), name, amountCents, dueDate };
    onUpdateOverride({ oneTimeBills: [...override.oneTimeBills, newBill] });
    setAddingOneTime(false);
  }

  function handleDeleteOneTime(id: string) {
    onUpdateOverride({ oneTimeBills: override.oneTimeBills.filter((b) => b.id !== id) });
  }

  async function handleUseCheckingBalance() {
    setBalanceError('');
    setFetchingBalance(true);
    try {
      const getCheckingBalance = httpsCallable<Record<never, never>, { balanceCents: number }>(
        functions,
        'getCheckingBalance'
      );
      const result = await getCheckingBalance({});
      onUpdateOverride({ paycheckAmountCents: result.data.balanceCents });
    } catch (err: unknown) {
      setBalanceError(err instanceof Error ? err.message : 'Failed to fetch balance.');
    } finally {
      setFetchingBalance(false);
    }
  }

  function handleTogglePaymentStatus(billKey: string) {
    const statuses = override.billPaymentStatuses ?? {};
    const current = statuses[billKey];
    const next = nextPaymentStatus(current);
    const updated = { ...statuses };
    if (next === undefined) {
      delete updated[billKey];
    } else {
      updated[billKey] = next;
    }
    onUpdateOverride({ billPaymentStatuses: updated });
  }

  // Separate bill types for rendering
  const regularBills = period.bills.filter((b) => !b.isOneTime && !b.movedFromPeriod);
  const movedInBills = period.bills.filter((b) => b.movedFromPeriod !== undefined);
  const oneTimeBills = period.bills.filter((b) => b.isOneTime);

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
          {/* ── Paycheck row ── */}
          <tr className="row-paycheck">
            <td>
              Paycheck
              {isPaycheckOverridden && <span className="override-tag"> (overridden)</span>}
            </td>
            <td className="amount">
              {formatCents(period.paycheckAmountCents)}
              <button
                className="btn-xs btn-inline"
                onClick={() => setEditingPaycheck((v) => !v)}
                aria-label="Edit paycheck amount"
                title="Override paycheck for this period"
              >
                ✏️
              </button>
              {isCurrentPeriod && plaidLinked && (
                <button
                  className="btn-xs btn-inline"
                  onClick={handleUseCheckingBalance}
                  disabled={fetchingBalance}
                  aria-label="Use Wells Fargo Checking balance as paycheck"
                  title="Set paycheck to current Wells Fargo Checking balance"
                >
                  {fetchingBalance ? '…' : '🏦'}
                </button>
              )}
            </td>
          </tr>
          {balanceError && (
            <tr className="row-balance-error">
              <td colSpan={2}>
                <span className="inline-error">{balanceError}</span>
              </td>
            </tr>
          )}
          {editingPaycheck && (
            <PaycheckEditRow
              currentCents={period.paycheckAmountCents}
              defaultCents={defaultPaycheckCents}
              isOverridden={isPaycheckOverridden}
              onSave={handleSavePaycheck}
              onCancel={() => setEditingPaycheck(false)}
            />
          )}

          {/* ── Regular recurring bills ── */}
          {regularBills.map(({ bill, dueDate }) => {
            const key = billKey(bill.id);
            const status = (override.billPaymentStatuses ?? {})[key];
            return (
              <tr key={`r-${bill.id}`} className={`row-bill${status === 'processed' ? ' row-bill-processed' : status === 'submitted' ? ' row-bill-submitted' : ''}`}>
                <td>
                  {bill.name}
                  <span className="due-date"> (due {formatDate(dueDate)})</span>
                </td>
                <td className="amount neg">
                  -{formatCents(bill.amountCents)}
                  <button
                    className={paymentStatusClassName(status)}
                    onClick={() => handleTogglePaymentStatus(key)}
                    aria-label={paymentStatusTitle(status)}
                    title={paymentStatusTitle(status)}
                  >
                    {paymentStatusIcon(status)}
                  </button>
                  <button
                    className="btn-xs btn-inline"
                    onClick={() => setMovingBillId(movingBillId === bill.id ? null : bill.id)}
                    aria-label="Move bill to another period"
                    title="Move to another pay period"
                  >
                    ↔
                  </button>
                </td>
              </tr>
            );
          })}
          {movingBillId !== null && regularBills.some((b) => b.bill.id === movingBillId) && (() => {
            const moving = regularBills.find((b) => b.bill.id === movingBillId)!;
            return (
              <MoveSelectorRow
                key={`move-${movingBillId}`}
                allPeriods={allPeriods}
                currentPeriodStart={period.startDate}
                bill={moving.bill}
                onMove={(toPeriodStart, toDueDate) => handleMoveConfirm(movingBillId, toPeriodStart, toDueDate)}
                onCancel={() => setMovingBillId(null)}
              />
            );
          })()}

          {/* ── Bills moved in from other periods ── */}
          {movedInBills.map(({ bill, dueDate, movedFromPeriod }, idx) => {
            const key = billKey(bill.id);
            const status = (override.billPaymentStatuses ?? {})[key];
            return (
              <tr key={`mv-${bill.id}-${movedFromPeriod}-${idx}`} className={`row-bill row-moved${status === 'processed' ? ' row-bill-processed' : status === 'submitted' ? ' row-bill-submitted' : ''}`}>
                <td>
                  {bill.name}
                  <span className="due-date"> (due {formatDate(dueDate)})</span>
                  <span className="moved-tag"> ↔ moved</span>
                </td>
                <td className="amount neg">
                  -{formatCents(bill.amountCents)}
                  <button
                    className={paymentStatusClassName(status)}
                    onClick={() => handleTogglePaymentStatus(key)}
                    aria-label={paymentStatusTitle(status)}
                    title={paymentStatusTitle(status)}
                  >
                    {paymentStatusIcon(status)}
                  </button>
                  <button
                    className="btn-xs btn-inline btn-danger-xs"
                    onClick={() => onUnmoveBill(bill.id, movedFromPeriod!)}
                    aria-label="Cancel move"
                    title="Move bill back to original period"
                  >
                    ↩
                  </button>
                </td>
              </tr>
            );
          })}

          {/* ── One-time bills ── */}
          {oneTimeBills.map(({ bill, dueDate, oneTimeBillId }) => {
            const key = oneTimeBillId!;
            const status = (override.billPaymentStatuses ?? {})[key];
            return (
              <tr key={`ot-${oneTimeBillId}`} className={`row-bill row-one-time${status === 'processed' ? ' row-bill-processed' : status === 'submitted' ? ' row-bill-submitted' : ''}`}>
                <td>
                  {bill.name}
                  <span className="due-date"> (due {formatDate(dueDate)})</span>
                  <span className="one-time-tag"> ✦ one-time</span>
                </td>
                <td className="amount neg">
                  -{formatCents(bill.amountCents)}
                  <button
                    className={paymentStatusClassName(status)}
                    onClick={() => handleTogglePaymentStatus(key)}
                    aria-label={paymentStatusTitle(status)}
                    title={paymentStatusTitle(status)}
                  >
                    {paymentStatusIcon(status)}
                  </button>
                  <button
                    className="btn-xs btn-inline btn-danger-xs"
                    onClick={() => handleDeleteOneTime(oneTimeBillId!)}
                    aria-label="Delete one-time bill"
                    title="Remove this one-time bill"
                  >
                    🗑
                  </button>
                </td>
              </tr>
            );
          })}

          {/* ── Add one-time bill ── */}
          {!addingOneTime ? (
            <tr className="row-add-one-time">
              <td colSpan={2}>
                <button
                  className="btn-xs btn-add-one-time"
                  onClick={() => setAddingOneTime(true)}
                >
                  + Add one-time bill
                </button>
              </td>
            </tr>
          ) : (
            <AddOneTimeBillRow
              periodStart={period.startDate}
              periodEnd={period.endDate}
              onAdd={handleAddOneTime}
              onCancel={() => setAddingOneTime(false)}
            />
          )}

          {/* ── Savings ── */}
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

// ── Page ───────────────────────────────────────────────────────────────────

interface Props {
  bills: Bill[];
  settings: PaySettings | null;
  overrides: PeriodOverrides;
  plaidLinked: boolean;
  onUpdatePeriodOverride: (periodStart: string, patch: Partial<PayPeriodOverride>) => void;
  onMoveBill: (billId: number, fromPeriodStart: string, toPeriodStart: string, toDueDate: string) => void;
  onUnmoveBill: (billId: number, fromPeriodStart: string, toPeriodStart: string) => void;
  onUndo: () => void;
  canUndo: boolean;
}

export default function PayPeriodsPage({
  bills,
  settings,
  overrides,
  plaidLinked,
  onUpdatePeriodOverride,
  onMoveBill,
  onUnmoveBill,
  onUndo,
  canUndo,
}: Props) {
  if (!settings) {
    return (
      <div className="empty-state">
        <p>No settings configured yet.</p>
        <p>Go to <strong>Settings</strong> to enter your paycheck details.</p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const periods = generatePayPeriods(settings, bills, 24, overrides);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Pay Periods</h1>
        <button
          className="btn-secondary btn-undo"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo last change"
        >
          ↩ Undo
        </button>
      </div>
      <div className="period-list">
        {periods.map((p) => (
          <PeriodCard
            key={p.startDate}
            period={p}
            allPeriods={periods}
            override={overrides[p.startDate] ?? emptyOverride()}
            defaultPaycheckCents={settings.paycheckAmountCents}
            isCurrentPeriod={p.startDate <= today && today <= p.endDate}
            plaidLinked={plaidLinked}
            onUpdateOverride={(patch) => onUpdatePeriodOverride(p.startDate, patch)}
            onMoveBill={(billId, toPeriodStart, toDueDate) =>
              onMoveBill(billId, p.startDate, toPeriodStart, toDueDate)
            }
            onUnmoveBill={(billId, fromPeriodStart) =>
              onUnmoveBill(billId, fromPeriodStart, p.startDate)
            }
          />
        ))}
      </div>
    </div>
  );
}
