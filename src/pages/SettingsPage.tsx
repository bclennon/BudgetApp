import { useState, useEffect } from 'react';
import type { Frequency, PaySettings } from '../domain/models';
import { useTheme, type Theme } from '../theme/ThemeContext';

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'system', label: 'System', icon: '💻' },
  { value: 'light',  label: 'Light',  icon: '☀️' },
  { value: 'dark',   label: 'Dark',   icon: '🌙' },
];

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
  const { theme, setTheme } = useTheme();
  const [paycheck, setPaycheck] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('BIWEEKLY');
  const [nextPayday, setNextPayday] = useState('');
  const [minSpendPerDay, setMinSpendPerDay] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (settings) {
      setPaycheck(dollarsToStr(settings.paycheckAmountCents));
      setFrequency(settings.frequency);
      setNextPayday(settings.nextPayday);
      setMinSpendPerDay(dollarsToStr(settings.minSpendPerDayCents ?? 0));
    }
  }, [settings]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const paycheckCents = strToCents(paycheck);
    const minSpendCents = strToCents(minSpendPerDay);
    if (isNaN(paycheckCents) || paycheckCents <= 0) {
      setError('Enter a valid paycheck amount.');
      return;
    }
    if (!nextPayday) {
      setError('Select a next payday date.');
      return;
    }
    if (isNaN(minSpendCents) || minSpendCents < 0) {
      setError('Enter a valid minimum spending per day amount.');
      return;
    }
    onSave({ paycheckAmountCents: paycheckCents, frequency, nextPayday, minSpendPerDayCents: minSpendCents });
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
            <label>Min. Spending / Day ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={minSpendPerDay}
              onChange={(e) => setMinSpendPerDay(e.target.value)}
              placeholder="0.00"
            />
            <p className="field-hint">
              Amount reserved for daily spending each day. Any surplus above this is applied toward credit card payments.
            </p>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">Save Settings</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="card-title">Appearance</h2>
        <p className="card-desc">Choose your preferred color theme.</p>
        <div className="theme-picker">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`theme-btn${theme === opt.value ? ' active' : ''}`}
              onClick={() => setTheme(opt.value)}
            >
              <span className="theme-btn-icon">{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
