import { useState } from 'react';
import type { Bill } from '../domain/models';

function formatCents(cents: number): string {
  return '$' + (cents / 100).toFixed(2);
}

function dollarsToStr(cents: number): string {
  return (cents / 100).toFixed(2);
}

function strToCents(value: string): number {
  return Math.round(parseFloat(value) * 100);
}

interface BillFormProps {
  initial?: Bill;
  onSave: (name: string, dayOfMonth: number, amountCents: number) => void;
  onCancel: () => void;
}

function BillForm({ initial, onSave, onCancel }: BillFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [day, setDay] = useState(String(initial?.dayOfMonth ?? 1));
  const [amount, setAmount] = useState(initial ? dollarsToStr(initial.amountCents) : '');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dayNum = parseInt(day, 10);
    const amountNum = parseFloat(amount);
    if (!name.trim()) { setError('Name is required.'); return; }
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) { setError('Day must be 1–31.'); return; }
    if (isNaN(amountNum) || amountNum <= 0) { setError('Enter a valid amount.'); return; }
    onSave(name.trim(), dayNum, strToCents(amount));
  }

  return (
    <form className="bill-form" onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      <div className="form-group">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rent" />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Day of month</label>
          <input
            type="number"
            min={1}
            max={31}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Amount ($)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn-primary">{initial ? 'Save' : 'Add Bill'}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

interface Props {
  bills: Bill[];
  onAdd: (name: string, dayOfMonth: number, amountCents: number) => void;
  onUpdate: (bill: Bill) => void;
  onDelete: (id: number) => void;
}

export default function BillsPage({ bills, onAdd, onUpdate, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  function handleAdd(name: string, dayOfMonth: number, amountCents: number) {
    onAdd(name, dayOfMonth, amountCents);
    setAdding(false);
  }

  function handleUpdate(bill: Bill, name: string, dayOfMonth: number, amountCents: number) {
    onUpdate({ ...bill, name, dayOfMonth, amountCents });
    setEditingId(null);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Bills</h1>
        {!adding && (
          <button className="btn-primary" onClick={() => setAdding(true)}>+ Add Bill</button>
        )}
      </div>

      {adding && (
        <div className="card">
          <h2 className="card-title">New Bill</h2>
          <BillForm onSave={handleAdd} onCancel={() => setAdding(false)} />
        </div>
      )}

      {bills.length === 0 && !adding && (
        <div className="empty-state">No bills added yet.</div>
      )}

      <div className="bill-list">
        {bills.map((bill) => (
          <div key={bill.id} className="card bill-card">
            {editingId === bill.id ? (
              <>
                <h2 className="card-title">Edit Bill</h2>
                <BillForm
                  initial={bill}
                  onSave={(name, day, amt) => handleUpdate(bill, name, day, amt)}
                  onCancel={() => setEditingId(null)}
                />
              </>
            ) : (
              <div className="bill-row">
                <div className="bill-info">
                  <span className="bill-name">{bill.name}</span>
                  <span className="bill-meta">
                    Due day {bill.dayOfMonth} · {formatCents(bill.amountCents)}
                  </span>
                </div>
                <div className="bill-actions">
                  <button
                    className="btn-icon"
                    onClick={() => setEditingId(bill.id)}
                    aria-label="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => {
                      if (confirm(`Delete "${bill.name}"?`)) onDelete(bill.id);
                    }}
                    aria-label="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
