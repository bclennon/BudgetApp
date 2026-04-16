import { useState } from 'react';
import type { BackupData, Bill, PaySettings } from '../domain/models';

interface Props {
  bills: Bill[];
  settings: PaySettings | null;
  onImport: (bills: Bill[], settings: PaySettings | null) => void;
}

export default function BackupSyncPage({ bills, settings, onImport }: Props) {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  function handleExport() {
    const data: BackupData = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings,
      bills,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget_backup.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Backup downloaded.');
    setError('');
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const raw = e.target?.result as string;
          const data = JSON.parse(raw) as BackupData;
          if (data.schemaVersion !== 1) {
            setError('Unsupported backup version.');
            setStatus('');
            return;
          }
          if (!confirm('This will replace all current data. Continue?')) return;
          onImport(data.bills ?? [], data.settings ?? null);
          setStatus('Data restored successfully.');
          setError('');
        } catch {
          setError('Failed to parse backup file. Make sure it is a valid Budget App JSON backup.');
          setStatus('');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  return (
    <div className="page">
      <h1 className="page-title">Backup &amp; Sync</h1>

      {status && <p className="form-success">{status}</p>}
      {error && <p className="form-error">{error}</p>}

      <div className="card">
        <h2 className="card-title">Export Backup</h2>
        <p className="card-desc">
          Download your bills and settings as a <code>budget_backup.json</code> file.
        </p>
        <button className="btn-primary" onClick={handleExport}>
          💾 Download Backup
        </button>
      </div>

      <div className="card">
        <h2 className="card-title">Restore from Backup</h2>
        <p className="card-desc">
          Select a previously exported <code>budget_backup.json</code> file to restore your data.
          <strong> This will replace all current data.</strong>
        </p>
        <button className="btn-secondary" onClick={handleImport}>
          📂 Choose Backup File
        </button>
      </div>

      <div className="card info-card">
        <h2 className="card-title">Current Data</h2>
        <p>{bills.length} bill{bills.length !== 1 ? 's' : ''}</p>
        <p>{settings ? 'Settings configured' : 'No settings configured'}</p>
      </div>
    </div>
  );
}
