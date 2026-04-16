import { useState } from 'react';
import type { CreditCard } from '../domain/models';

function formatCents(cents: number): string {
  return '$' + (cents / 100).toFixed(2);
}

function dollarsToStr(cents: number): string {
  return (cents / 100).toFixed(2);
}

function strToCents(value: string): number {
  return Math.round(parseFloat(value) * 100);
}

interface CardFormProps {
  initial?: CreditCard;
  onSave: (name: string, balanceCents: number, transferExpirationDate: string | undefined) => void;
  onCancel: () => void;
}

function CardForm({ initial, onSave, onCancel }: CardFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [balance, setBalance] = useState(initial ? dollarsToStr(initial.balanceCents) : '');
  const [expiryDate, setExpiryDate] = useState(initial?.transferExpirationDate ?? '');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    const balanceCents = strToCents(balance);
    if (isNaN(balanceCents) || balanceCents < 0) { setError('Enter a valid balance (0 or more).'); return; }
    onSave(name.trim(), balanceCents, expiryDate.trim() || undefined);
  }

  return (
    <form className="bill-form" onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      <div className="form-group">
        <label>Card Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chase Freedom" />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Current Balance ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="form-group">
          <label>Balance Transfer Expiry <span className="field-hint">(optional)</span></label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn-primary">{initial ? 'Save' : 'Add Card'}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

interface Props {
  cards: CreditCard[];
  onAdd: (name: string, balanceCents: number, transferExpirationDate: string | undefined) => void;
  onUpdate: (card: CreditCard) => void;
  onDelete: (id: string) => void;
}

function formatExpiry(date: string | undefined): string {
  if (!date) return '';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function CreditCardsPage({ cards, onAdd, onUpdate, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleAdd(name: string, balanceCents: number, transferExpirationDate: string | undefined) {
    onAdd(name, balanceCents, transferExpirationDate);
    setAdding(false);
  }

  function handleUpdate(card: CreditCard, name: string, balanceCents: number, transferExpirationDate: string | undefined) {
    onUpdate({ ...card, name, balanceCents, transferExpirationDate });
    setEditingId(null);
  }

  const totalDebt = cards.reduce((sum, c) => sum + c.balanceCents, 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Credit Cards</h1>
        {!adding && (
          <button className="btn-primary" onClick={() => setAdding(true)}>+ Add Card</button>
        )}
      </div>

      {totalDebt > 0 && (
        <div className="cc-total-debt">
          Total debt: <strong>{formatCents(totalDebt)}</strong>
          <span className="cc-payoff-note"> — remainder each pay period is applied to debt</span>
        </div>
      )}

      {adding && (
        <div className="card">
          <h2 className="card-title">New Credit Card</h2>
          <CardForm onSave={handleAdd} onCancel={() => setAdding(false)} />
        </div>
      )}

      {cards.length === 0 && !adding && (
        <div className="empty-state">
          <p>No credit cards added yet.</p>
          <p>Add a card to start tracking debt payoff.</p>
        </div>
      )}

      <div className="bill-list">
        {cards.map((card) => (
          <div key={card.id} className="card bill-card">
            {editingId === card.id ? (
              <>
                <h2 className="card-title">Edit Credit Card</h2>
                <CardForm
                  initial={card}
                  onSave={(name, bal, expiry) => handleUpdate(card, name, bal, expiry)}
                  onCancel={() => setEditingId(null)}
                />
              </>
            ) : (
              <div className="bill-row">
                <div className="bill-info">
                  <span className="bill-name">{card.name}</span>
                  <span className="bill-meta">
                    Balance: {formatCents(card.balanceCents)}
                    {card.transferExpirationDate && (
                      <> · Transfer expires {formatExpiry(card.transferExpirationDate)}</>
                    )}
                  </span>
                  {card.balanceCents === 0 && (
                    <span className="cc-paid-off">✓ Paid off</span>
                  )}
                </div>
                <div className="bill-actions">
                  <button
                    className="btn-icon"
                    onClick={() => setEditingId(card.id)}
                    aria-label="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => {
                      if (confirm(`Delete "${card.name}"?`)) onDelete(card.id);
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
