import { useState, useEffect } from 'react';
import type { Bill, CreditCard, CreditCardPayment, PaySettings, PeriodOverrides, PayPeriodOverride } from './domain/models';
import { emptyOverride } from './domain/models';
import {
  loadBills, loadSettings, saveBills, saveSettings, getNextBillId,
  loadBillsFromCloud, saveBillsToCloud, loadSettingsFromCloud, saveSettingsToCloud,
  loadPeriodOverrides, savePeriodOverrides,
  loadPeriodOverridesFromCloud, savePeriodOverridesToCloud,
  loadCreditCards, saveCreditCards,
  loadCreditCardsFromCloud, saveCreditCardsToCloud,
} from './data/storage';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ThemeProvider } from './theme/ThemeContext';
import SignInPage from './pages/SignInPage';
import PayPeriodsPage from './pages/PayPeriodsPage';
import BillsPage from './pages/BillsPage';
import SettingsPage from './pages/SettingsPage';
import BackupSyncPage from './pages/BackupSyncPage';
import CreditCardsPage from './pages/CreditCardsPage';

type Tab = 'periods' | 'bills' | 'creditcards' | 'settings' | 'backup';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'periods', label: 'Pay Periods', icon: '📅' },
  { id: 'bills', label: 'Bills', icon: '🧾' },
  { id: 'creditcards', label: 'Credit Cards', icon: '💳' },
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
  const [creditCards, setCreditCards] = useState<CreditCard[]>(() => loadCreditCards());
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
      const [cloudBills, cloudSettings, cloudOverrides, cloudCreditCards] = await Promise.all([
        loadBillsFromCloud(uid),
        loadSettingsFromCloud(uid),
        loadPeriodOverridesFromCloud(uid),
        loadCreditCardsFromCloud(uid),
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
      if (cloudCreditCards !== null) {
        setCreditCards(cloudCreditCards);
        saveCreditCards(cloudCreditCards);
      }
      setCloudLoaded(true);
    }
    syncFromCloud();
    return () => { cancelled = true; };
  }, [user]);

  function addBill(name: string, dayOfMonth: number, amountCents: number, url: string) {
    const newBill: Bill = { id: getNextBillId(bills), name, dayOfMonth, amountCents };
    if (url) newBill.url = url;
    const updated = [...bills, newBill];
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

  function addCreditCard(name: string, balanceCents: number, transferExpirationDate: string | undefined) {
    const newCard: CreditCard = {
      id: crypto.randomUUID(),
      name,
      balanceCents,
      transferExpirationDate,
    };
    const updated = [...creditCards, newCard];
    setCreditCards(updated);
    saveCreditCards(updated);
    if (user) saveCreditCardsToCloud(user.uid, updated);
  }

  function updateCreditCard(card: CreditCard) {
    const updated = creditCards.map((c) => (c.id === card.id ? card : c));
    setCreditCards(updated);
    saveCreditCards(updated);
    if (user) saveCreditCardsToCloud(user.uid, updated);
  }

  function deleteCreditCard(id: string) {
    const updated = creditCards.filter((c) => c.id !== id);
    setCreditCards(updated);
    saveCreditCards(updated);
    if (user) saveCreditCardsToCloud(user.uid, updated);
  }

  function handleCreditCardPaymentProcessed(_periodStart: string, payments: CreditCardPayment[]) {
    const updated = creditCards.map((c) => {
      const payment = payments.find((p) => p.cardId === c.id);
      if (!payment) return c;
      return { ...c, balanceCents: Math.max(0, c.balanceCents - payment.amountCents) };
    });
    setCreditCards(updated);
    saveCreditCards(updated);
    if (user) saveCreditCardsToCloud(user.uid, updated);
  }

  function handleCreditCardPaymentRestored(_periodStart: string, payments: CreditCardPayment[]) {
    const updated = creditCards.map((c) => {
      const payment = payments.find((p) => p.cardId === c.id);
      if (!payment) return c;
      return { ...c, balanceCents: c.balanceCents + payment.amountCents };
    });
    setCreditCards(updated);
    saveCreditCards(updated);
    if (user) saveCreditCardsToCloud(user.uid, updated);
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
    const merged: PayPeriodOverride = { ...prev, ...patch };
    // Remove optional fields that are explicitly cleared so that storage (especially
    // Firestore, which rejects undefined values) doesn't receive undefined.
    if (merged.paycheckAmountCents === undefined) delete merged.paycheckAmountCents;
    if (merged.creditCardPaymentStatuses === undefined) delete merged.creditCardPaymentStatuses;
    if (merged.creditCardPaymentStatus === undefined) delete merged.creditCardPaymentStatus;
    if (merged.creditCardPayments === undefined) delete merged.creditCardPayments;
    if (merged.creditCardPaymentAmountCents === undefined) delete merged.creditCardPaymentAmountCents;
    if (merged.creditCardPaymentCardId === undefined) delete merged.creditCardPaymentCardId;
    applyOverrides({ ...periodOverrides, [periodStart]: merged });
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
            creditCards={creditCards}
            onUpdatePeriodOverride={updatePeriodOverride}
            onMoveBill={moveBill}
            onUnmoveBill={unmoveBill}
            onUndo={undo}
            canUndo={undoHistory.length > 0}
            onCreditCardPaymentProcessed={handleCreditCardPaymentProcessed}
            onCreditCardPaymentRestored={handleCreditCardPaymentRestored}
          />
        )}
        {tab === 'bills' && (
          <BillsPage bills={bills} onAdd={addBill} onUpdate={updateBill} onDelete={deleteBill} onImportBills={importBills} />
        )}
        {tab === 'creditcards' && (
          <CreditCardsPage
            cards={creditCards}
            onAdd={addCreditCard}
            onUpdate={updateCreditCard}
            onDelete={deleteCreditCard}
          />
        )}
        {tab === 'settings' && <SettingsPage settings={settings} onSave={updateSettings} />}
        {tab === 'backup' && (
          <BackupSyncPage
            bills={bills}
            settings={settings}
            creditCards={creditCards}
            periodOverrides={periodOverrides}
            onImport={importData}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}

