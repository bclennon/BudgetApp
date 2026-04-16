import { useState, useEffect } from 'react';
import type { Frequency, PaySettings } from '../domain/models';

const FREQUENCY_LABELS: Record<Frequency, string> = {
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Bi-weekly',
  SEMI_MONTHLY: 'Semi-monthly (15th & 30th)',
  MONTHLY: 'Monthly',
};

function dollarsToStr(cents: number): string {
  return (cents / 100).toFixed(2);
}

function strToCents(value: string): number {
  return Math.round(parseFloat(value) * 100);
}

interface Props {
  settings: PaySettings | null;
  onSave: (settings: PaySettings) => void;
}

export default function SettingsPage({ settings, onSave }: Props) {
  const [paycheck, setPaycheck] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('BIWEEKLY');
  const [nextPayday, setNextPayday] = useState('');
  const [targetSpending, setTargetSpending] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (settings) {
      setPaycheck(dollarsToStr(settings.paycheckAmountCents));
      setFrequency(settings.frequency);
      setNextPayday(settings.nextPayday);
      setTargetSpending(dollarsToStr(settings.targetSpendingPerDayCents));
    }
  }, [settings]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const paycheckCents = strToCents(paycheck);
    const targetCents = strToCents(targetSpending);
    if (isNaN(paycheckCents) || paycheckCents <= 0) {
      setError('Enter a valid paycheck amount.');
      return;
    }
    if (!nextPayday) {
      setError('Select a next payday date.');
      return;
    }
    if (isNaN(targetCents) || targetCents < 0) {
      setError('Enter a valid target spending amount.');
      return;
    }
    onSave({ paycheckAmountCents: paycheckCents, frequency, nextPayday, targetSpendingPerDayCents: targetCents });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>
      <div className="card">
        <form onSubmit={handleSubmit}>
          {error && <p className="form-error">{error}</p>}
          {saved && <p className="form-success">Settings saved!</p>}

          <div className="form-group">
            <label>Paycheck Amount ($)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={paycheck}
              onChange={(e) => setPaycheck(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="form-group">
            <label>Pay Frequency</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              {(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((f) => (
                <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Next Payday</label>
            <input
              type="date"
              value={nextPayday}
              onChange={(e) => setNextPayday(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Target Spending / Day ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={targetSpending}
              onChange={(e) => setTargetSpending(e.target.value)}
              placeholder="0.00"
            />
            <p className="field-hint">
              When daily spending exceeds this target, the extra becomes savings.
            </p>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">Save Settings</button>
          </div>
        </form>
      </div>
    </div>
  );
}
