import { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
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
  onPlaidLinked: () => void;
}

export default function SettingsPage({ settings, onSave, onPlaidLinked }: Props) {
  const [paycheck, setPaycheck] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('BIWEEKLY');
  const [nextPayday, setNextPayday] = useState('');
  const [targetSpending, setTargetSpending] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Plaid state
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [plaidLoading, setPlaidLoading] = useState(false);
  const [plaidError, setPlaidError] = useState('');
  const isLinked = settings?.plaidLinked ?? false;

  useEffect(() => {
    if (settings) {
      setPaycheck(dollarsToStr(settings.paycheckAmountCents));
      setFrequency(settings.frequency);
      setNextPayday(settings.nextPayday);
      setTargetSpending(dollarsToStr(settings.targetSpendingPerDayCents));
    }
  }, [settings]);

  // ── Plaid Link ──────────────────────────────────────────────────────────

  async function handleLinkBankAccount() {
    setPlaidError('');
    setPlaidLoading(true);
    try {
      const createLinkToken = httpsCallable<Record<never, never>, { linkToken: string }>(
        functions,
        'createLinkToken'
      );
      const result = await createLinkToken({});
      setLinkToken(result.data.linkToken);
    } catch (err: unknown) {
      setPlaidError(err instanceof Error ? err.message : 'Failed to start bank linking.');
    } finally {
      setPlaidLoading(false);
    }
  }

  const onPlaidSuccess = useCallback(
    async (publicToken: string) => {
      setPlaidError('');
      setPlaidLoading(true);
      try {
        const exchangePublicToken = httpsCallable<{ publicToken: string }, { success: boolean }>(
          functions,
          'exchangePublicToken'
        );
        await exchangePublicToken({ publicToken });
        setLinkToken(null);
        onPlaidLinked();
      } catch (err: unknown) {
        setPlaidError(err instanceof Error ? err.message : 'Failed to link bank account.');
      } finally {
        setPlaidLoading(false);
      }
    },
    [onPlaidLinked]
  );

  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: () => setLinkToken(null),
  });

  // Open the Plaid modal automatically once a link token is available.
  useEffect(() => {
    if (linkToken && plaidReady) {
      openPlaidLink();
    }
  }, [linkToken, plaidReady, openPlaidLink]);

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

      <div className="card">
        <h2 className="card-title">Bank Account</h2>
        <p className="field-hint">
          Link your Wells Fargo Checking account to use your current balance as the paycheck
          amount for any pay period.
        </p>
        {plaidError && <p className="form-error">{plaidError}</p>}
        {isLinked ? (
          <div className="plaid-status">
            <span className="plaid-linked-badge">✓ Bank account linked</span>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleLinkBankAccount}
              disabled={plaidLoading}
            >
              {plaidLoading ? 'Connecting…' : 'Re-link Account'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={handleLinkBankAccount}
            disabled={plaidLoading}
          >
            {plaidLoading ? 'Connecting…' : '🏦 Link Bank Account'}
          </button>
        )}
      </div>
    </div>
  );
}
