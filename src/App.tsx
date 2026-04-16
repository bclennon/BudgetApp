import { useState } from 'react';
import type { Bill, PaySettings } from './domain/models';
import { loadBills, loadSettings, saveBills, saveSettings, getNextBillId } from './data/storage';
import PayPeriodsPage from './pages/PayPeriodsPage';
import BillsPage from './pages/BillsPage';
import SettingsPage from './pages/SettingsPage';
import BackupSyncPage from './pages/BackupSyncPage';
import LoginPage from './pages/LoginPage';
import { useAuth } from './auth/useAuth';
import { googleLogout } from '@react-oauth/google';

type Tab = 'periods' | 'bills' | 'settings' | 'backup';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'periods', label: 'Pay Periods', icon: '📅' },
  { id: 'bills', label: 'Bills', icon: '🧾' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'backup', label: 'Backup', icon: '💾' },
];

export default function App() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('periods');
  const [bills, setBills] = useState<Bill[]>(() => loadBills());
  const [settings, setSettings] = useState<PaySettings | null>(() => loadSettings());

  if (!user) {
    return <LoginPage />;
  }

  function addBill(name: string, dayOfMonth: number, amountCents: number) {
    const updated = [...bills, { id: getNextBillId(bills), name, dayOfMonth, amountCents }];
    setBills(updated);
    saveBills(updated);
  }

  function updateBill(bill: Bill) {
    const updated = bills.map((b) => (b.id === bill.id ? bill : b));
    setBills(updated);
    saveBills(updated);
  }

  function deleteBill(id: number) {
    const updated = bills.filter((b) => b.id !== id);
    setBills(updated);
    saveBills(updated);
  }

  function updateSettings(s: PaySettings) {
    setSettings(s);
    saveSettings(s);
  }

  function importBills(items: { name: string; dayOfMonth: number; amountCents: number }[]) {
    const updated = [...bills];
    for (const item of items) {
      updated.push({ id: getNextBillId(updated), ...item });
    }
    setBills(updated);
    saveBills(updated);
  }

  function importData(newBills: Bill[], newSettings: PaySettings | null) {
    setBills(newBills);
    saveBills(newBills);
    if (newSettings) {
      setSettings(newSettings);
      saveSettings(newSettings);
    }
  }

  function handleSignOut() {
    googleLogout();
    signOut();
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
        <button className="tab-btn user-btn" onClick={handleSignOut} title={`Sign out (${user.email})`}>
          <img src={user.picture} alt={user.name} className="user-avatar" />
          <span className="tab-label">Sign Out</span>
        </button>
      </nav>

      <main className="content">
        {tab === 'periods' && <PayPeriodsPage bills={bills} settings={settings} />}
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
