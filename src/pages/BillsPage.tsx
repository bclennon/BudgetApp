import { useState } from 'react';
import type { Bill } from '../domain/models';
import { parseImportText, type ParsedBillRow } from '../domain/billImporter';

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

interface ImportPanelProps {
  onConfirm: (items: { name: string; dayOfMonth: number; amountCents: number }[]) => void;
  onCancel: () => void;
}

function ImportPanel({ onConfirm, onCancel }: ImportPanelProps) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<ParsedBillRow[] | null>(null);

  function handleParse() {
    setRows(parseImportText(text));
  }

  const validRows = rows?.filter((r) => !r.error) ?? [];
  const errorRows = rows?.filter((r) => r.error) ?? [];

  function handleConfirm() {
    onConfirm(validRows);
  }

  return (
    <div className="card">
      <h2 className="card-title">Import Bills</h2>
      <p className="card-desc">
        Paste tab-delimited text below. Each line should be: <strong>name</strong> · <strong>day</strong> · <strong>amount</strong>
      </p>
      {rows === null ? (
        <>
          <div className="form-group">
            <textarea
              className="import-textarea"
              rows={10}
              placeholder={'Rent\t1\t1200\nNetflix\t15\t$20'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleParse} disabled={!text.trim()}>
              Preview
            </button>
            <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          {errorRows.length > 0 && (
            <div className="form-error" style={{ marginBottom: 12 }}>
              {errorRows.length} line{errorRows.length !== 1 ? 's' : ''} could not be parsed and will be skipped:
              <ul className="import-error-list">
                {errorRows.map((r, i) => (
                  <li key={i}><strong>{r.name}</strong>: {r.error}</li>
                ))}
              </ul>
            </div>
          )}
          {validRows.length > 0 ? (
            <>
              <table className="import-preview-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Day</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {validRows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td>{r.dayOfMonth}</td>
                      <td>{formatCents(r.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="form-actions" style={{ marginTop: 14 }}>
                <button className="btn-primary" onClick={handleConfirm}>
                  Add {validRows.length} Bill{validRows.length !== 1 ? 's' : ''}
                </button>
                <button className="btn-secondary" onClick={() => setRows(null)}>Back</button>
                <button className="btn-secondary" onClick={onCancel}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <p className="card-desc">No valid bills found.</p>
              <div className="form-actions">
                <button className="btn-secondary" onClick={() => setRows(null)}>Back</button>
                <button className="btn-secondary" onClick={onCancel}>Cancel</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}


interface Props {
  bills: Bill[];
  onAdd: (name: string, dayOfMonth: number, amountCents: number) => void;
  onUpdate: (bill: Bill) => void;
  onDelete: (id: number) => void;
  onImportBills: (items: { name: string; dayOfMonth: number; amountCents: number }[]) => void;
}

export default function BillsPage({ bills, onAdd, onUpdate, onDelete, onImportBills }: Props) {
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  function handleAdd(name: string, dayOfMonth: number, amountCents: number) {
    onAdd(name, dayOfMonth, amountCents);
    setAdding(false);
  }

  function handleImport(items: { name: string; dayOfMonth: number; amountCents: number }[]) {
    onImportBills(items);
    setImporting(false);
  }

  function handleUpdate(bill: Bill, name: string, dayOfMonth: number, amountCents: number) {
    onUpdate({ ...bill, name, dayOfMonth, amountCents });
    setEditingId(null);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Bills</h1>
        {!adding && !importing && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => setImporting(true)}>⬆ Import</button>
            <button className="btn-primary" onClick={() => setAdding(true)}>+ Add Bill</button>
          </div>
        )}
      </div>

      {importing && (
        <ImportPanel onConfirm={handleImport} onCancel={() => setImporting(false)} />
      )}

      {adding && (
        <div className="card">
          <h2 className="card-title">New Bill</h2>
          <BillForm onSave={handleAdd} onCancel={() => setAdding(false)} />
        </div>
      )}

      {bills.length === 0 && !adding && !importing && (
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
