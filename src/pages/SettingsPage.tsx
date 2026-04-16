import { useState, useEffect } from 'react';
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

// Minimal type declarations for the Sophtron widget loader injected via CDN.
interface SophtronFinishData {
  _type: string;
  step: string;
  UserInstitutionID?: string;
  [key: string]: unknown;
}

interface SophtronWidgetConfig {
  env: string;
  integration_key: string;
  request_id: string;
  onFinish?: (data: SophtronFinishData) => boolean;
  onError?: (data: unknown) => void;
}

interface SophtronWidget {
  init: (action: string, config: SophtronWidgetConfig, reinit?: boolean) => void;
  show: () => void;
  destroy: () => void;
}

declare global {
  interface Window {
    sophtron?: SophtronWidget;
  }
}

/** Dynamically loads the Sophtron widget script from the CDN if not yet loaded. */
function loadSophtronScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.sophtron) {
      resolve();
      return;
    }
    const existingScript = document.getElementById(
      'sophtron-widget-script'
    ) as HTMLScriptElement | null;
    if (existingScript) {
      // If the script tag already exists but the load event has already fired
      // (window.sophtron would be defined in that case, caught above), we still
      // attach handlers for the in-flight loading case.
      if (existingScript.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () =>
        reject(new Error('Failed to load Sophtron widget.'))
      );
      return;
    }
    const script = document.createElement('script');
    script.id = 'sophtron-widget-script';
    script.src = 'https://cdn.sophtron.com/sophtron-widget-loader-0.0.0.6.min.js';
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Sophtron widget.'));
    document.head.appendChild(script);
  });
}

interface Props {
  settings: PaySettings | null;
  onSave: (settings: PaySettings) => void;
  onBankLinked: () => void;
}

export default function SettingsPage({ settings, onSave, onBankLinked }: Props) {
  const [paycheck, setPaycheck] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('BIWEEKLY');
  const [nextPayday, setNextPayday] = useState('');
  const [targetSpending, setTargetSpending] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Bank linking state
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState('');
  const isLinked = settings?.bankLinked ?? false;

  useEffect(() => {
    if (settings) {
      setPaycheck(dollarsToStr(settings.paycheckAmountCents));
      setFrequency(settings.frequency);
      setNextPayday(settings.nextPayday);
      setTargetSpending(dollarsToStr(settings.targetSpendingPerDayCents));
    }
  }, [settings]);

  // ── Sophtron Link ──────────────────────────────────────────────────────────

  async function handleSophtronSuccess(data: SophtronFinishData) {
    const userInstitutionId = data.UserInstitutionID;
    if (!userInstitutionId) {
      setBankError('Bank linked but account ID was not returned. Please try again.');
      return;
    }
    setBankLoading(true);
    try {
      const saveFn = httpsCallable<{ userInstitutionId: string }, { success: boolean }>(
        functions,
        'saveSophtronUserInstitution'
      );
      await saveFn({ userInstitutionId });
      onBankLinked();
    } catch (err: unknown) {
      setBankError(err instanceof Error ? err.message : 'Failed to link bank account.');
    } finally {
      setBankLoading(false);
    }
  }

  async function handleLinkBankAccount() {
    setBankError('');
    setBankLoading(true);
    try {
      const getWidgetData = httpsCallable<
        Record<never, never>,
        { integrationKey: string; requestId: string }
      >(functions, 'getSophtronWidgetData');
      const result = await getWidgetData({});
      const { integrationKey, requestId } = result.data;

      await loadSophtronScript();

      window.sophtron!.init(
        'Add',
        {
          env: 'prod',
          integration_key: integrationKey,
          request_id: requestId,
          onFinish: (data) => {
            if (data.step === 'Success') {
              window.sophtron?.destroy();
              // Fire-and-forget; handleSophtronSuccess manages its own error state.
              handleSophtronSuccess(data);
              return true;
            }
            return false;
          },
          onError: () => {
            setBankError('Bank linking failed. Please try again.');
          },
        },
        true
      );
      window.sophtron!.show();
    } catch (err: unknown) {
      setBankError(err instanceof Error ? err.message : 'Failed to start bank linking.');
    } finally {
      setBankLoading(false);
    }
  }

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
          Link your checking account to use your current balance as the paycheck
          amount for any pay period.
        </p>
        {bankError && <p className="form-error">{bankError}</p>}
        {isLinked ? (
          <div className="bank-link-status">
            <span className="bank-linked-badge">✓ Bank account linked</span>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleLinkBankAccount}
              disabled={bankLoading}
            >
              {bankLoading ? 'Connecting…' : 'Re-link Account'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={handleLinkBankAccount}
            disabled={bankLoading}
          >
            {bankLoading ? 'Connecting…' : '🏦 Link Bank Account'}
          </button>
        )}
      </div>
    </div>
  );
}
