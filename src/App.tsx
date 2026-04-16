import { useState, useEffect } from 'react';
import type { Bill, PaySettings, PeriodOverrides, PayPeriodOverride } from './domain/models';
import { emptyOverride } from './domain/models';
import {
  loadBills, loadSettings, saveBills, saveSettings, getNextBillId,
  loadBillsFromCloud, saveBillsToCloud, loadSettingsFromCloud, saveSettingsToCloud,
  loadPeriodOverrides, savePeriodOverrides,
  loadPeriodOverridesFromCloud, savePeriodOverridesToCloud,
} from './data/storage';
import { AuthProvider, useAuth } from './auth/AuthContext';
import SignInPage from './pages/SignInPage';
import PayPeriodsPage from './pages/PayPeriodsPage';
import BillsPage from './pages/BillsPage';
import SettingsPage from './pages/SettingsPage';
import BackupSyncPage from './pages/BackupSyncPage';

type Tab = 'periods' | 'bills' | 'settings' | 'backup';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'periods', label: 'Pay Periods', icon: '📅' },
  { id: 'bills', label: 'Bills', icon: '🧾' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'backup', label: 'Backup', icon: '💾' },
];

// Maximum number of undo steps kept in memory per session.
const MAX_UNDO = 50;

function AppShell() {
  const { user, loading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('periods');
  const [bills, setBills] = useState<Bill[]>(() => loadBills());
  const [settings, setSettings] = useState<PaySettings | null>(() => loadSettings());
  const [periodOverrides, setPeriodOverrides] = useState<PeriodOverrides>(() => loadPeriodOverrides());
  const [undoHistory, setUndoHistory] = useState<PeriodOverrides[]>([]);
  const [cloudLoaded, setCloudLoaded] = useState(false);

  // Load from Firestore when the user signs in.
  useEffect(() => {
    if (!user) {
      setCloudLoaded(false);
      return;
    }
    let cancelled = false;
    const uid = user.uid;
    async function syncFromCloud() {
      const [cloudBills, cloudSettings, cloudOverrides] = await Promise.all([
        loadBillsFromCloud(uid),
        loadSettingsFromCloud(uid),
        loadPeriodOverridesFromCloud(uid),
      ]);
      if (cancelled) return;
      if (cloudBills !== null) {
        setBills(cloudBills);
        saveBills(cloudBills);
      }
      if (cloudSettings !== null) {
        setSettings(cloudSettings);
        saveSettings(cloudSettings);
      }
      if (cloudOverrides !== null) {
        setPeriodOverrides(cloudOverrides);
        savePeriodOverrides(cloudOverrides);
      }
      setCloudLoaded(true);
    }
    syncFromCloud();
    return () => { cancelled = true; };
  }, [user]);

  function addBill(name: string, dayOfMonth: number, amountCents: number) {
    const updated = [...bills, { id: getNextBillId(bills), name, dayOfMonth, amountCents }];
    setBills(updated);
    saveBills(updated);
    if (user) saveBillsToCloud(user.uid, updated);
  }

  function updateBill(bill: Bill) {
    const updated = bills.map((b) => (b.id === bill.id ? bill : b));
    setBills(updated);
    saveBills(updated);
    if (user) saveBillsToCloud(user.uid, updated);
  }

  function deleteBill(id: number) {
    const updated = bills.filter((b) => b.id !== id);
    setBills(updated);
    saveBills(updated);
    if (user) saveBillsToCloud(user.uid, updated);
  }

  function updateSettings(s: PaySettings) {
    setSettings(s);
    saveSettings(s);
    if (user) saveSettingsToCloud(user.uid, s);
  }

  function importBills(items: { name: string; dayOfMonth: number; amountCents: number }[]) {
    const updated = [...bills];
    for (const item of items) {
      updated.push({ id: getNextBillId(updated), ...item });
    }
    setBills(updated);
    saveBills(updated);
    if (user) saveBillsToCloud(user.uid, updated);
  }

  function importData(newBills: Bill[], newSettings: PaySettings | null) {
    setBills(newBills);
    saveBills(newBills);
    if (user) saveBillsToCloud(user.uid, newBills);
    if (newSettings) {
      setSettings(newSettings);
      saveSettings(newSettings);
      if (user) saveSettingsToCloud(user.uid, newSettings);
    }
  }

  /** Snapshot current overrides to undo history, then apply newOverrides. */
  function applyOverrides(newOverrides: PeriodOverrides) {
    setUndoHistory((prev) => [...prev.slice(-(MAX_UNDO - 1)), periodOverrides]);
    setPeriodOverrides(newOverrides);
    savePeriodOverrides(newOverrides);
    if (user) savePeriodOverridesToCloud(user.uid, newOverrides);
  }

  function updatePeriodOverride(periodStart: string, patch: Partial<PayPeriodOverride>) {
    const prev = periodOverrides[periodStart] ?? emptyOverride();
    applyOverrides({ ...periodOverrides, [periodStart]: { ...prev, ...patch } });
  }

  function moveBill(billId: number, fromPeriodStart: string, toPeriodStart: string, toDueDate: string) {
    const fromPrev = periodOverrides[fromPeriodStart] ?? emptyOverride();
    const toPrev = periodOverrides[toPeriodStart] ?? emptyOverride();
    const newOverrides = {
      ...periodOverrides,
      [fromPeriodStart]: {
        ...fromPrev,
        movedOutBillIds: [...fromPrev.movedOutBillIds, billId],
      },
      [toPeriodStart]: {
        ...toPrev,
        movedInBills: [...toPrev.movedInBills, { billId, fromPeriodStart, dueDate: toDueDate }],
      },
    };
    applyOverrides(newOverrides);
  }

  function unmoveBill(billId: number, fromPeriodStart: string, toPeriodStart: string) {
    const fromPrev = periodOverrides[fromPeriodStart] ?? emptyOverride();
    const toPrev = periodOverrides[toPeriodStart] ?? emptyOverride();
    const newOverrides = {
      ...periodOverrides,
      [fromPeriodStart]: {
        ...fromPrev,
        movedOutBillIds: fromPrev.movedOutBillIds.filter((id) => id !== billId),
      },
      [toPeriodStart]: {
        ...toPrev,
        movedInBills: toPrev.movedInBills.filter((m) => !(m.billId === billId && m.fromPeriodStart === fromPeriodStart)),
      },
    };
    applyOverrides(newOverrides);
  }

  function undo() {
    setUndoHistory((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      const newHistory = prev.slice(0, -1);
      setPeriodOverrides(previous);
      savePeriodOverrides(previous);
      if (user) savePeriodOverridesToCloud(user.uid, previous);
      return newHistory;
    });
  }

  if (loading) {
    return (
      <div className="app-loading">
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <SignInPage />;
  }

  return (
    <div className="app">
      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
        <button className="tab-btn" onClick={signOut} title={`Signed in as ${user.displayName ?? user.email}`}>
          <span className="tab-icon">👤</span>
          <span className="tab-label">Sign Out</span>
        </button>
      </nav>

      {!cloudLoaded && (
        <div className="cloud-loading-bar">Syncing data…</div>
      )}

      <main className="content">
        {tab === 'periods' && (
          <PayPeriodsPage
            bills={bills}
            settings={settings}
            overrides={periodOverrides}
            onUpdatePeriodOverride={updatePeriodOverride}
            onMoveBill={moveBill}
            onUnmoveBill={unmoveBill}
            onUndo={undo}
            canUndo={undoHistory.length > 0}
          />
        )}
        {tab === 'bills' && (
          <BillsPage bills={bills} onAdd={addBill} onUpdate={updateBill} onDelete={deleteBill} onImportBills={importBills} />
        )}
        {tab === 'settings' && <SettingsPage settings={settings} onSave={updateSettings} />}
        {tab === 'backup' && (
          <BackupSyncPage bills={bills} settings={settings} onImport={importData} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

