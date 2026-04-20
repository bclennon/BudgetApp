import { useState, useMemo } from 'react';
import type { Bill, CreditCard, CreditCardPayment, PayPeriod, PaySettings, PeriodOverrides, PayPeriodOverride, BillPaymentStatus } from '../domain/models';
import { emptyOverride, getPlannedCardPayments } from '../domain/models';
import { generatePayPeriods, daysBetween } from '../domain/payPeriodGenerator';
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

// ── Bill amount edit row ───────────────────────────────────────────────────

interface BillAmountEditProps {
  currentCents: number;
  defaultCents: number;
  isOverridden: boolean;
  onSave: (cents: number | undefined) => void;
  onCancel: () => void;
}

function BillAmountEditRow({ currentCents, defaultCents, isOverridden, onSave, onCancel }: BillAmountEditProps) {
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
    <tr className="row-bill-amount-edit">
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

/** Returns the URL only if it uses the http or https protocol; otherwise returns null. */
function safeBillUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

// ── Period card ────────────────────────────────────────────────────────────

interface PeriodCardProps {
  period: PayPeriod;
  allPeriods: PayPeriod[];
  allBills: Bill[];
  override: PayPeriodOverride;
  defaultPaycheckCents: number;
  creditCards: CreditCard[];
  today: string;
  onUpdateOverride: (patch: Partial<PayPeriodOverride>) => void;
  onMoveBill: (billId: number, toPeriodStart: string, toDueDate: string) => void;
  onUnmoveBill: (billId: number, fromPeriodStart: string) => void;
  onCreditCardPaymentProcessed: (payments: CreditCardPayment[]) => void;
  onCreditCardPaymentRestored: (payments: CreditCardPayment[]) => void;
}

function PeriodCard({
  period,
  allPeriods,
  allBills,
  override,
  defaultPaycheckCents,
  creditCards,
  today,
  onUpdateOverride,
  onMoveBill,
  onUnmoveBill,
  onCreditCardPaymentProcessed,
  onCreditCardPaymentRestored,
}: PeriodCardProps) {
  const [editingPaycheck, setEditingPaycheck] = useState(false);
  const [movingBillId, setMovingBillId] = useState<number | null>(null);
  const [addingOneTime, setAddingOneTime] = useState(false);
  const [editingBillKey, setEditingBillKey] = useState<string | null>(null);

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

  function handleDeleteBill(billId: number) {
    const current = override.deletedBillIds ?? [];
    if (!current.includes(billId)) {
      onUpdateOverride({ deletedBillIds: [...current, billId] });
    }
  }

  function handleUndeleteBill(billId: number) {
    onUpdateOverride({ deletedBillIds: (override.deletedBillIds ?? []).filter((id) => id !== billId) });
  }

  function handleSaveBillAmount(key: string, cents: number | undefined) {
    const current = override.billAmountOverrides ?? {};
    if (cents === undefined) {
      const updated = { ...current };
      delete updated[key];
      onUpdateOverride({ billAmountOverrides: Object.keys(updated).length > 0 ? updated : undefined });
    } else {
      onUpdateOverride({ billAmountOverrides: { ...current, [key]: cents } });
    }
    setEditingBillKey(null);
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

  // Returns the payment status for a specific credit card in this period.
  // Reads from the new per-card map; falls back to the legacy global field for old saved data.
  function getCardStatus(cardId: string): BillPaymentStatus | undefined {
    if (override.creditCardPaymentStatuses) {
      return override.creditCardPaymentStatuses[cardId];
    }
    return override.creditCardPaymentStatus;
  }

  // Planned payments: distribute surplus across cards in priority order.
  // Only surplus funds (above the minimum daily spend) are available for CC payments.
  const availableCents = period.hasSurplus ? period.surplusCents : 0;
  const plannedPayments = getPlannedCardPayments(availableCents, creditCards);

  // Map of cardId → stored amount (set when a card's payment was processed).
  // Supports both the new multi-card format and legacy single-card fields.
  const storedPaymentsMap = new Map(
    (override.creditCardPayments ??
      (override.creditCardPaymentCardId
        ? [{ cardId: override.creditCardPaymentCardId, amountCents: override.creditCardPaymentAmountCents ?? 0 }]
        : [])
    ).map((p) => [p.cardId, p.amountCents]),
  );

  // Build per-card display rows.
  // Each card appears if it has a planned payment or a stored (processed) payment.
  // Processed cards show their stored amount; others show their planned amount.
  const plannedMap = new Map(plannedPayments.map((p) => [p.card.id, p]));
  const allCardIds = new Set([...plannedMap.keys(), ...storedPaymentsMap.keys()]);
  const displayPayments: { card: CreditCard; amountCents: number }[] = [];
  for (const cardId of allCardIds) {
    const card = creditCards.find((c) => c.id === cardId);
    if (!card) continue;
    const status = getCardStatus(cardId);
    if (status === 'processed') {
      const amount = storedPaymentsMap.get(cardId);
      if (amount !== undefined) displayPayments.push({ card, amountCents: amount });
    } else {
      const p = plannedMap.get(cardId);
      if (p) displayPayments.push({ card, amountCents: p.amountCents });
    }
  }

  // Only count CC payments that have NOT yet been marked as processed.
  const unprocessedCcCents = displayPayments
    .filter(({ card }) => getCardStatus(card.id) !== 'processed')
    .reduce((s, p) => s + p.amountCents, 0);

  // Once all CC payments are processed, stop deducting them from Remaining.
  const effectiveRemainingCents = period.remainingCents - unprocessedCcCents;

  // Total of all bills and CC payments that have NOT been marked as processed.
  const billStatuses = override.billPaymentStatuses ?? {};
  const unprocessedBillsCents = period.bills.reduce((sum, bip) => {
    const key = bip.isOneTime ? bip.oneTimeBillId! : billKey(bip.bill.id);
    return billStatuses[key] === 'processed' ? sum : sum + (bip.amountOverrideCents ?? bip.bill.amountCents);
  }, 0);
  const totalUnprocessedCents = unprocessedBillsCents + unprocessedCcCents;

  // Use remaining days in the period for the current period so the rate
  // reflects how much can actually be spent from today forward.
  const isCurrentPeriod = today >= period.startDate && today <= period.endDate;
  const remainingDays = isCurrentPeriod
    ? daysBetween(today, period.endDate) + 1
    : period.daysInPeriod;
  const effectiveDays = Math.max(1, remainingDays);
  const effectiveSpendingPerDay = Math.trunc(effectiveRemainingCents / effectiveDays);

  function handleToggleCardPaymentStatus(cardId: string, plannedAmountCents: number) {
    // Migrate legacy single-status data to per-card on first interaction.
    const baseStatuses: Record<string, BillPaymentStatus> = override.creditCardPaymentStatuses
      ? { ...override.creditCardPaymentStatuses }
      : {};
    if (!override.creditCardPaymentStatuses && override.creditCardPaymentStatus) {
      const legacyStatus = override.creditCardPaymentStatus;
      // Seed all cards that have a payment in this period (planned or stored).
      for (const { card } of displayPayments) {
        baseStatuses[card.id] = legacyStatus;
      }
    }

    const current = baseStatuses[cardId];
    const next = nextPaymentStatus(current);
    const newStatuses = { ...baseStatuses };
    if (next === undefined) {
      delete newStatuses[cardId];
    } else {
      newStatuses[cardId] = next;
    }

    // Base patch: write per-card statuses and clear the legacy global field.
    const basePatch: Partial<PayPeriodOverride> = {
      creditCardPaymentStatuses: newStatuses,
      creditCardPaymentStatus: undefined,
    };

    if (next === 'processed') {
      // Permanently reduce this card's balance and record its payment amount.
      onCreditCardPaymentProcessed([{ cardId, amountCents: plannedAmountCents }]);
      const newPayments = [
        ...(override.creditCardPayments ?? []).filter((p) => p.cardId !== cardId),
        { cardId, amountCents: plannedAmountCents },
      ];
      onUpdateOverride({ ...basePatch, creditCardPayments: newPayments });
    } else if (next === undefined && current === 'processed') {
      // Restore this card's balance.
      const storedAmount = storedPaymentsMap.get(cardId);
      if (storedAmount !== undefined) {
        onCreditCardPaymentRestored([{ cardId, amountCents: storedAmount }]);
      }
      const newPayments = (override.creditCardPayments ?? []).filter((p) => p.cardId !== cardId);
      onUpdateOverride({
        ...basePatch,
        creditCardPayments: newPayments.length > 0 ? newPayments : undefined,
      });
    } else {
      onUpdateOverride(basePatch);
    }
  }

  // Separate bill types for rendering
  const regularBills = period.bills.filter((b) => !b.isOneTime && !b.movedFromPeriod);
  const movedInBills = period.bills.filter((b) => b.movedFromPeriod !== undefined);
  const oneTimeBills = period.bills.filter((b) => b.isOneTime);

  // Deleted (skipped) bills: look up full bill objects from allBills
  const deletedBillIds = override.deletedBillIds ?? [];
  const deletedBills = deletedBillIds
    .map((id) => allBills.find((b) => b.id === id))
    .filter((b): b is Bill => b !== undefined);

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
            </td>
          </tr>
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
          {regularBills.map(({ bill, dueDate, amountOverrideCents }) => {
            const key = billKey(bill.id);
            const status = (override.billPaymentStatuses ?? {})[key];
            const isAmountOverridden = amountOverrideCents !== undefined;
            const effectiveAmount = amountOverrideCents ?? bill.amountCents;
            return (
              <tr key={`r-${bill.id}`} className={`row-bill${status === 'processed' ? ' row-bill-processed' : status === 'submitted' ? ' row-bill-submitted' : ''}`}>
                <td>
                  {(() => { const href = safeBillUrl(bill.url); return href ? (<a href={href} target="_blank" rel="noopener noreferrer">{bill.name}</a>) : bill.name; })()}
                  <span className="due-date"> (due {formatDate(dueDate)})</span>
                  {isAmountOverridden && <span className="override-tag"> (overridden)</span>}
                </td>
                <td className="amount neg">
                  -{formatCents(effectiveAmount)}
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
                    onClick={() => setEditingBillKey(editingBillKey === key ? null : key)}
                    aria-label="Edit bill amount for this period"
                    title="Override amount for this period"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn-xs btn-inline"
                    onClick={() => setMovingBillId(movingBillId === bill.id ? null : bill.id)}
                    aria-label="Move bill to another period"
                    title="Move to another pay period"
                  >
                    ↔
                  </button>
                  <button
                    className="btn-xs btn-inline btn-danger-xs"
                    onClick={() => handleDeleteBill(bill.id)}
                    aria-label="Delete bill from this period"
                    title="Remove this bill from this pay period"
                  >
                    🗑
                  </button>
                </td>
              </tr>
            );
          })}
          {editingBillKey !== null && regularBills.some((b) => billKey(b.bill.id) === editingBillKey) && (() => {
            const editing = regularBills.find((b) => billKey(b.bill.id) === editingBillKey)!;
            return (
              <BillAmountEditRow
                key={`amount-edit-${editingBillKey}`}
                currentCents={editing.amountOverrideCents ?? editing.bill.amountCents}
                defaultCents={editing.bill.amountCents}
                isOverridden={editing.amountOverrideCents !== undefined}
                onSave={(cents) => handleSaveBillAmount(editingBillKey, cents)}
                onCancel={() => setEditingBillKey(null)}
              />
            );
          })()}
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
          {movedInBills.map(({ bill, dueDate, movedFromPeriod, amountOverrideCents }, idx) => {
            const key = billKey(bill.id);
            const status = (override.billPaymentStatuses ?? {})[key];
            const isAmountOverridden = amountOverrideCents !== undefined;
            const effectiveAmount = amountOverrideCents ?? bill.amountCents;
            return (
              <tr key={`mv-${bill.id}-${movedFromPeriod}-${idx}`} className={`row-bill row-moved${status === 'processed' ? ' row-bill-processed' : status === 'submitted' ? ' row-bill-submitted' : ''}`}>
                <td>
                  {(() => { const href = safeBillUrl(bill.url); return href ? (<a href={href} target="_blank" rel="noopener noreferrer">{bill.name}</a>) : bill.name; })()}
                  <span className="due-date"> (due {formatDate(dueDate)})</span>
                  <span className="moved-tag"> ↔ moved</span>
                  {isAmountOverridden && <span className="override-tag"> (overridden)</span>}
                </td>
                <td className="amount neg">
                  -{formatCents(effectiveAmount)}
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
                    onClick={() => setEditingBillKey(editingBillKey === key ? null : key)}
                    aria-label="Edit bill amount for this period"
                    title="Override amount for this period"
                  >
                    ✏️
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
          {editingBillKey !== null && movedInBills.some((b) => billKey(b.bill.id) === editingBillKey) && (() => {
            const editing = movedInBills.find((b) => billKey(b.bill.id) === editingBillKey)!;
            return (
              <BillAmountEditRow
                key={`amount-edit-mv-${editingBillKey}`}
                currentCents={editing.amountOverrideCents ?? editing.bill.amountCents}
                defaultCents={editing.bill.amountCents}
                isOverridden={editing.amountOverrideCents !== undefined}
                onSave={(cents) => handleSaveBillAmount(editingBillKey, cents)}
                onCancel={() => setEditingBillKey(null)}
              />
            );
          })()}

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
                    className="btn-xs btn-inline"
                    onClick={() => setEditingBillKey(editingBillKey === key ? null : key)}
                    aria-label="Edit bill amount for this period"
                    title="Override amount for this period"
                  >
                    ✏️
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
          {/* One-time bills are period-specific entries, so editing updates their amount directly
              rather than through billAmountOverrides. There is no original "bill amount" to reset to. */}
          {editingBillKey !== null && oneTimeBills.some((b) => b.oneTimeBillId === editingBillKey) && (() => {
            const editing = oneTimeBills.find((b) => b.oneTimeBillId === editingBillKey)!;
            return (
              <BillAmountEditRow
                key={`amount-edit-ot-${editingBillKey}`}
                currentCents={editing.bill.amountCents}
                defaultCents={editing.bill.amountCents}
                isOverridden={false}
                onSave={(cents) => {
                  if (cents !== undefined) {
                    onUpdateOverride({
                      oneTimeBills: override.oneTimeBills.map((b) =>
                        b.id === editingBillKey ? { ...b, amountCents: cents } : b
                      ),
                    });
                  }
                  setEditingBillKey(null);
                }}
                onCancel={() => setEditingBillKey(null)}
              />
            );
          })()}

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

          {/* ── Deleted (skipped) bills ── */}
          {deletedBills.map((bill) => (
            <tr key={`del-${bill.id}`} className="row-bill row-bill-deleted">
              <td>
                <span className="deleted-bill-name">{bill.name}</span>
                <span className="deleted-tag"> ✕ skipped</span>
              </td>
              <td className="amount neg deleted-bill-amount">
                -{formatCents(bill.amountCents)}
                <button
                  className="btn-xs btn-inline"
                  onClick={() => handleUndeleteBill(bill.id)}
                  aria-label="Restore bill to this period"
                  title="Restore bill to this pay period"
                >
                  ↩
                </button>
              </td>
            </tr>
          ))}

          {/* ── Credit card payment(s) ── */}
          {displayPayments.map(({ card, amountCents }) => (
            <tr
              key={card.id}
              className={`row-cc-payment${getCardStatus(card.id) === 'processed' ? ' row-bill-processed' : getCardStatus(card.id) === 'submitted' ? ' row-bill-submitted' : ''}`}
            >
              <td>
                → {card.name}
                {card.transferExpirationDate && (
                  <span className="due-date"> (exp. {card.transferExpirationDate})</span>
                )}
              </td>
              <td className="amount neg">
                -{formatCents(amountCents)}
                <button
                  className={paymentStatusClassName(getCardStatus(card.id))}
                  onClick={() => handleToggleCardPaymentStatus(card.id, amountCents)}
                  aria-label={paymentStatusTitle(getCardStatus(card.id))}
                  title={paymentStatusTitle(getCardStatus(card.id))}
                >
                  {paymentStatusIcon(getCardStatus(card.id))}
                </button>
              </td>
            </tr>
          ))}

          <tr className="row-divider">
            <td colSpan={2} />
          </tr>

          <tr className="row-unprocessed">
            <td>Not processed</td>
            <td className="amount neg">
              -{formatCents(totalUnprocessedCents)}
            </td>
          </tr>

          <tr className="row-remaining">
            <td>Remaining</td>
            <td className={`amount ${effectiveRemainingCents < 0 ? 'neg' : 'pos'}`}>
              {formatCents(effectiveRemainingCents)}
            </td>
          </tr>

          <tr className="row-spending">
            <td>Spending / day</td>
            <td className={`amount ${effectiveSpendingPerDay < 0 ? 'neg' : ''}`}>
              {formatCents(effectiveSpendingPerDay)}
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
  creditCards: CreditCard[];
  onUpdatePeriodOverride: (periodStart: string, patch: Partial<PayPeriodOverride>) => void;
  onMoveBill: (billId: number, fromPeriodStart: string, toPeriodStart: string, toDueDate: string) => void;
  onUnmoveBill: (billId: number, fromPeriodStart: string, toPeriodStart: string) => void;
  onUndo: () => void;
  canUndo: boolean;
  onCreditCardPaymentProcessed: (periodStart: string, payments: CreditCardPayment[]) => void;
  onCreditCardPaymentRestored: (periodStart: string, payments: CreditCardPayment[]) => void;
}

export default function PayPeriodsPage({
  bills,
  settings,
  overrides,
  creditCards,
  onUpdatePeriodOverride,
  onMoveBill,
  onUnmoveBill,
  onUndo,
  canUndo,
  onCreditCardPaymentProcessed,
  onCreditCardPaymentRestored,
}: Props) {
  if (!settings) {
    return (
      <div className="empty-state">
        <p>No settings configured yet.</p>
        <p>Go to <strong>Settings</strong> to enter your paycheck details.</p>
      </div>
    );
  }

  const periods = generatePayPeriods(settings, bills, 24, overrides);

  const todayDate = new Date();
  const today = todayDate.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

  // Compute per-period adjusted credit card balances.
  // When a period plans to pay toward credit cards (even before marked
  // as submitted/processed), those amounts are deducted from the running balances
  // so that subsequent periods see the correct remaining debt.
  // Cards whose payment is already 'processed' are skipped because the
  // CreditCard.balanceCents in app state has already been permanently reduced.
  const periodsWithCards = useMemo(() => {
    const result: { period: PayPeriod; adjustedCards: CreditCard[] }[] = [];
    let runningCards = creditCards;
    for (const period of periods) {
      const adjustedCards = runningCards;
      const override = overrides[period.startDate];
      const ccStatuses = override?.creditCardPaymentStatuses;
      const legacyCcProcessed = !ccStatuses && override?.creditCardPaymentStatus === 'processed';

      if (!legacyCcProcessed) {
        const plannedAmount = period.hasSurplus ? period.surplusCents : 0;
        const payments = getPlannedCardPayments(plannedAmount, adjustedCards);
        if (payments.length > 0) {
          const paymentMap = new Map(payments.map((p) => [p.card.id, p.amountCents]));
          runningCards = runningCards.map((c) => {
            const planned = paymentMap.get(c.id);
            if (!planned) return c;
            // Skip deduction for cards whose payment is already permanently processed.
            if (ccStatuses?.[c.id] === 'processed') return c;
            return { ...c, balanceCents: Math.max(0, c.balanceCents - planned) };
          });
        }
      }
      result.push({ period, adjustedCards });
    }
    return result;
  }, [periods, creditCards, overrides]);

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
        {periodsWithCards.map(({ period, adjustedCards }) => (
          <PeriodCard
            key={period.startDate}
            period={period}
            allPeriods={periods}
            allBills={bills}
            override={overrides[period.startDate] ?? emptyOverride()}
            defaultPaycheckCents={settings.paycheckAmountCents}
            creditCards={adjustedCards}
            today={today}
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
          />
        ))}
      </div>
    </div>
  );
}
