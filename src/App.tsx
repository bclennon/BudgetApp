import { useState, useEffect, useCallback, useRef } from 'react';
import type { Bill, CreditCard, CreditCardPayment, PaySettings, PeriodOverrides, PayPeriodOverride } from './domain/models';
import { emptyOverride } from './domain/models';
import {
  loadBills, loadSettings, saveBills, saveSettings, getNextBillId,
  loadPeriodOverrides, savePeriodOverrides,
  loadCreditCards, saveCreditCards,
} from './data/storage';
import {
  getOrCreateSpreadsheet,
  findSpreadsheetId,
  createNewSpreadsheet,
  loadAllFromSheets,
  saveBillsToSheets,
  saveSettingsToSheets,
  savePeriodOverridesToSheets,
  saveCreditCardsToSheets,
  clearStoredSpreadsheetId,
  addSheetTabsToSpreadsheet,
  SpreadsheetNotFoundError,
  SheetTabsNotFoundError,
} from './data/sheetsStorage';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ThemeProvider } from './theme/ThemeContext';
import { IconThemeProvider, useIconTheme } from './theme/IconThemeContext';
import SignInPage from './pages/SignInPage';
import PayPeriodsPage from './pages/PayPeriodsPage';
import BillsPage from './pages/BillsPage';
import SettingsPage from './pages/SettingsPage';
import BackupSyncPage from './pages/BackupSyncPage';
import CreditCardsPage from './pages/CreditCardsPage';
import ArchivedPeriodsPage from './pages/ArchivedPeriodsPage';

type Tab = 'periods' | 'bills' | 'creditcards' | 'settings' | 'backup' | 'archived';

const TABS: { id: Tab; label: string }[] = [
  { id: 'periods', label: 'Pay Periods' },
  { id: 'bills', label: 'Bills' },
  { id: 'creditcards', label: 'Credit Cards' },
  { id: 'settings', label: 'Settings' },
  { id: 'backup', label: 'Backup' },
  { id: 'archived', label: 'Archived' },
];

// Maximum number of undo steps kept in memory per session.
const MAX_UNDO = 50;

function AppShell() {
  const { user, loading, sheetsToken, requestSheetsToken, signOut } = useAuth();
  const { iconTheme } = useIconTheme();
  const [tab, setTab] = useState<Tab>('periods');
  const [bills, setBills] = useState<Bill[]>(() => loadBills());
  const [settings, setSettings] = useState<PaySettings | null>(() => loadSettings());
  const [periodOverrides, setPeriodOverrides] = useState<PeriodOverrides>(() => loadPeriodOverrides());
  const [creditCards, setCreditCards] = useState<CreditCard[]>(() => loadCreditCards());
  const [undoHistory, setUndoHistory] = useState<PeriodOverrides[]>([]);
  /** True once the initial load attempt (from Sheets or localStorage) has completed. */
  const [dataReady, setDataReady] = useState(false);
  /** Non-null when a cloud save failed; shown as a dismissible error banner. */
  const [cloudSaveError, setCloudSaveError] = useState<string | null>(null);
  /** True when the stored spreadsheet ID is stale (spreadsheet was deleted). */
  const [spreadsheetNotFound, setSpreadsheetNotFound] = useState(false);
  /** Non-null when expected sheet tabs are missing; holds the list of missing tab names. */
  const [missingSheetTabs, setMissingSheetTabs] = useState<string[] | null>(null);
  /** True when no BudgetApp Data spreadsheet was found in the user's Drive. */
  const [spreadsheetNotOnDrive, setSpreadsheetNotOnDrive] = useState(false);
  /** Incrementing this causes the Sheets sync useEffect to re-run (e.g. after repairing missing tabs). */
  const [syncKey, setSyncKey] = useState(0);
  // Holds the active spreadsheet ID once resolved.
  const spreadsheetIdRef = useRef<string | null>(null);
  // Deduplicates concurrent getOrCreateSpreadsheet calls to prevent race-condition duplicates.
  const spreadsheetIdPromiseRef = useRef<Promise<string> | null>(null);

  /**
   * Returns a valid sheets token, requesting a fresh one if needed.
   * Throws if the token cannot be obtained (e.g. user cancels the OAuth popup).
   */
  const getToken = useCallback(async (): Promise<string> => {
    if (sheetsToken) return sheetsToken;
    return requestSheetsToken();
  }, [sheetsToken, requestSheetsToken]);

  /**
   * Gets a valid token and the spreadsheet ID in a single step, requesting a
   * new OAuth token if one is not already available. Returns null only if the
   * user cancels the OAuth popup or the spreadsheet cannot be created.
   *
   * Using a single helper avoids calling getToken() twice per save (once inside
   * resolveSpreadsheetId and once for the write), which would trigger two
   * separate OAuth popups when the token is stale.
   */
  const getSheetContext = useCallback(async (uid: string): Promise<{ token: string; spreadsheetId: string } | null> => {
    try {
      const token = await getToken();
      if (spreadsheetIdRef.current) {
        return { token, spreadsheetId: spreadsheetIdRef.current };
      }
      // If a lookup/create is already in flight, wait for it instead of
      // launching a second one (which would create a duplicate spreadsheet).
      if (!spreadsheetIdPromiseRef.current) {
        spreadsheetIdPromiseRef.current = getOrCreateSpreadsheet(token, uid).then((id) => {
          spreadsheetIdRef.current = id;
          return id;
        }).finally(() => {
          spreadsheetIdPromiseRef.current = null;
        });
      }
      const spreadsheetId = await spreadsheetIdPromiseRef.current;
      return { token, spreadsheetId };
    } catch {
      return null;
    }
  }, [getToken]);

  // Load from Google Sheets when the user signs in and a sheets token is available.
  useEffect(() => {
    if (!user) {
      setDataReady(false);
      spreadsheetIdRef.current = null;
      spreadsheetIdPromiseRef.current = null;
      return;
    }
    // No sheets token yet — use localStorage data directly (no sync banner).
    if (!sheetsToken) {
      setDataReady(true);
      return;
    }
    let cancelled = false;
    const uid = user.uid;
    async function syncFromSheets() {
      try {
        // If we don't already know the spreadsheet ID, check whether one exists
        // before calling getSheetContext (which would auto-create one). This lets
        // us prompt the user before creating a brand-new spreadsheet.
        if (!spreadsheetIdRef.current) {
          const token = await getToken();
          const existingId = await findSpreadsheetId(token, uid);
          if (!existingId) {
            if (!cancelled) {
              setSpreadsheetNotOnDrive(true);
              setDataReady(true);
            }
            return;
          }
          spreadsheetIdRef.current = existingId;
        }
        const ctx = await getSheetContext(uid);
        if (!ctx || cancelled) return;
        const data = await loadAllFromSheets(ctx.token, ctx.spreadsheetId);
        if (cancelled) return;
        if (data.bills !== null) {
          setBills(data.bills);
          saveBills(data.bills);
        }
        if (data.settings !== null) {
          setSettings(data.settings);
          saveSettings(data.settings);
        }
        if (data.periodOverrides !== null) {
          setPeriodOverrides(data.periodOverrides);
          savePeriodOverrides(data.periodOverrides);
        }
        if (data.creditCards !== null) {
          setCreditCards(data.creditCards);
          saveCreditCards(data.creditCards);
        }
      } catch (err) {
        if (err instanceof SpreadsheetNotFoundError) {
          if (!cancelled) {
            clearStoredSpreadsheetId(uid);
            spreadsheetIdRef.current = null;
            spreadsheetIdPromiseRef.current = null;
            setSpreadsheetNotFound(true);
          }
        } else if (err instanceof SheetTabsNotFoundError) {
          if (!cancelled) setMissingSheetTabs(err.missingTabs);
        } else {
          console.error('Failed to sync from Google Sheets:', err);
        }
      } finally {
        if (!cancelled) setDataReady(true);
      }
    }
    syncFromSheets();
    return () => { cancelled = true; };
  }, [user, sheetsToken, getSheetContext, syncKey]);

  async function saveBillsCloud(bills: Bill[]) {
    if (!user) return;
    const ctx = await getSheetContext(user.uid);
    if (!ctx) return;
    try {
      await saveBillsToSheets(ctx.token, ctx.spreadsheetId, bills);
    } catch (err) {
      console.error('Failed to save bills to Google Sheets:', err);
      setCloudSaveError('Could not save bills to Google Sheets. Your changes are saved locally.');
    }
  }

  async function saveSettingsCloud(settings: PaySettings) {
    if (!user) return;
    const ctx = await getSheetContext(user.uid);
    if (!ctx) return;
    try {
      await saveSettingsToSheets(ctx.token, ctx.spreadsheetId, settings);
    } catch (err) {
      console.error('Failed to save settings to Google Sheets:', err);
      setCloudSaveError('Could not save settings to Google Sheets. Your changes are saved locally.');
    }
  }

  async function saveOverridesCloud(overrides: PeriodOverrides) {
    if (!user) return;
    const ctx = await getSheetContext(user.uid);
    if (!ctx) return;
    try {
      await savePeriodOverridesToSheets(ctx.token, ctx.spreadsheetId, overrides);
    } catch (err) {
      console.error('Failed to save period overrides to Google Sheets:', err);
      setCloudSaveError('Could not save period data to Google Sheets. Your changes are saved locally.');
    }
  }

  async function saveCardsCloud(cards: CreditCard[]) {
    if (!user) return;
    const ctx = await getSheetContext(user.uid);
    if (!ctx) return;
    try {
      await saveCreditCardsToSheets(ctx.token, ctx.spreadsheetId, cards);
    } catch (err) {
      console.error('Failed to save credit cards to Google Sheets:', err);
      setCloudSaveError('Could not save credit cards to Google Sheets. Your changes are saved locally.');
    }
  }

  /** Pushes all current local data to the active spreadsheet and sets a banner if any save fails. */
  async function pushLocalDataToSheets() {
    const results = await Promise.allSettled([
      saveBillsCloud(bills),
      ...(settings ? [saveSettingsCloud(settings)] : []),
      saveOverridesCloud(periodOverrides),
      saveCardsCloud(creditCards),
    ]);
    const anyFailed = results.some((r) => r.status === 'rejected');
    if (anyFailed) {
      setCloudSaveError('Some data could not be saved to the new Google Sheets file. Your changes are saved locally.');
    }
  }

  /** Called when the user confirms they want a new spreadsheet after the old one was not found. */
  async function handleCreateNewSpreadsheet() {
    if (!user) return;
    setSpreadsheetNotFound(false);
    await pushLocalDataToSheets();
  }

  /** Called when the user wants to add the missing sheet tabs back to the existing spreadsheet. */
  async function handleAddMissingSheetTabs() {
    if (!user || !missingSheetTabs) return;
    const tabs = missingSheetTabs;
    setMissingSheetTabs(null);
    const ctx = await getSheetContext(user.uid);
    if (!ctx) return;
    try {
      await addSheetTabsToSpreadsheet(ctx.token, ctx.spreadsheetId, tabs);
      // Re-trigger the sync so the newly created tabs are loaded.
      setDataReady(false);
      setSyncKey((k) => k + 1);
    } catch (err) {
      console.error('Failed to add missing sheet tabs:', err);
      setCloudSaveError('Could not add the missing sheet tabs. Please try again.');
    }
  }

  /** Called when the user confirms they want to create a new BudgetApp Data spreadsheet. */
  async function handleCreateSpreadsheet() {
    if (!user) return;
    setSpreadsheetNotOnDrive(false);
    setDataReady(false);
    try {
      const token = await getToken();
      const newId = await createNewSpreadsheet(token, user.uid);
      spreadsheetIdRef.current = newId;
    } catch (err) {
      console.error('Failed to create spreadsheet:', err);
      setCloudSaveError('Could not create the spreadsheet. Please try again.');
      setDataReady(true);
      return;
    }
    await pushLocalDataToSheets();
    setDataReady(true);
  }

  function addBill(name: string, dayOfMonth: number, amountCents: number, url: string) {
    const newBill: Bill = { id: getNextBillId(bills), name, dayOfMonth, amountCents };
    if (url) newBill.url = url;
    const updated = [...bills, newBill];
    setBills(updated);
    saveBills(updated);
    saveBillsCloud(updated);
  }

  function updateBill(bill: Bill) {
    const updated = bills.map((b) => (b.id === bill.id ? bill : b));
    setBills(updated);
    saveBills(updated);
    saveBillsCloud(updated);
  }

  function deleteBill(id: number) {
    const updated = bills.filter((b) => b.id !== id);
    setBills(updated);
    saveBills(updated);
    saveBillsCloud(updated);
  }

  function updateSettings(s: PaySettings) {
    setSettings(s);
    saveSettings(s);
    saveSettingsCloud(s);
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
    saveCardsCloud(updated);
  }

  function updateCreditCard(card: CreditCard) {
    const updated = creditCards.map((c) => (c.id === card.id ? card : c));
    setCreditCards(updated);
    saveCreditCards(updated);
    saveCardsCloud(updated);
  }

  function deleteCreditCard(id: string) {
    const updated = creditCards.filter((c) => c.id !== id);
    setCreditCards(updated);
    saveCreditCards(updated);
    saveCardsCloud(updated);
  }

  function handleCreditCardPaymentProcessed(_periodStart: string, payments: CreditCardPayment[]) {
    const updated = creditCards.map((c) => {
      const payment = payments.find((p) => p.cardId === c.id);
      if (!payment) return c;
      return { ...c, balanceCents: Math.max(0, c.balanceCents - payment.amountCents) };
    });
    setCreditCards(updated);
    saveCreditCards(updated);
    saveCardsCloud(updated);
  }

  function handleCreditCardPaymentRestored(_periodStart: string, payments: CreditCardPayment[]) {
    const updated = creditCards.map((c) => {
      const payment = payments.find((p) => p.cardId === c.id);
      if (!payment) return c;
      return { ...c, balanceCents: c.balanceCents + payment.amountCents };
    });
    setCreditCards(updated);
    saveCreditCards(updated);
    saveCardsCloud(updated);
  }

  function importBills(items: { name: string; dayOfMonth: number; amountCents: number }[]) {
    const updated = [...bills];
    for (const item of items) {
      updated.push({ id: getNextBillId(updated), ...item });
    }
    setBills(updated);
    saveBills(updated);
    saveBillsCloud(updated);
  }

  function importData(newBills: Bill[], newSettings: PaySettings | null) {
    setBills(newBills);
    saveBills(newBills);
    saveBillsCloud(newBills);
    if (newSettings) {
      setSettings(newSettings);
      saveSettings(newSettings);
      saveSettingsCloud(newSettings);
    }
  }

  /** Snapshot current overrides to undo history, then apply newOverrides. */
  function applyOverrides(newOverrides: PeriodOverrides) {
    setUndoHistory((prev) => [...prev.slice(-(MAX_UNDO - 1)), periodOverrides]);
    setPeriodOverrides(newOverrides);
    savePeriodOverrides(newOverrides);
    saveOverridesCloud(newOverrides);
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

  function archivePeriod(periodStart: string) {
    const prev = periodOverrides[periodStart] ?? emptyOverride();
    applyOverrides({ ...periodOverrides, [periodStart]: { ...prev, archived: true } });
  }

  function unarchivePeriod(periodStart: string) {
    const prev = periodOverrides[periodStart] ?? emptyOverride();
    const updated = { ...prev };
    delete updated.archived;
    applyOverrides({ ...periodOverrides, [periodStart]: updated });
  }

  function undo() {
    setUndoHistory((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      const newHistory = prev.slice(0, -1);
      setPeriodOverrides(previous);
      savePeriodOverrides(previous);
      saveOverridesCloud(previous);
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

  const TAB_ICONS: Record<string, string> = {
    periods: iconTheme.icons.periods,
    bills: iconTheme.icons.bills,
    creditcards: iconTheme.icons.creditCards,
    settings: iconTheme.icons.settings,
    backup: iconTheme.icons.backup,
    archived: iconTheme.icons.archived,
  };

  return (
    <div className="app">
      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{TAB_ICONS[t.id]}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
        <button className="tab-btn" onClick={signOut} title={`Signed in as ${user.displayName ?? user.email}`}>
          <span className="tab-icon">{iconTheme.icons.signOut}</span>
          <span className="tab-label">Sign Out</span>
        </button>
      </nav>

      {!dataReady && (
        <div className="cloud-loading-bar">Syncing data…</div>
      )}

      {cloudSaveError && (
        <div className="cloud-error-bar" role="alert">
          ⚠️ {cloudSaveError}
          <button className="cloud-error-dismiss" onClick={() => setCloudSaveError(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      {spreadsheetNotFound && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 className="modal-title">📄 Data File Not Found</h2>
            <p className="modal-body">
              Your Google Sheets data file could not be found. It may have been deleted or moved.
              Would you like to create a new one? Your locally saved data will be preserved and synced to the new file.
            </p>
            <div className="modal-actions">
              <button className="btn-primary" onClick={handleCreateNewSpreadsheet}>
                Create New Spreadsheet
              </button>
              <button className="btn-secondary" onClick={() => setSpreadsheetNotFound(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {missingSheetTabs && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 className="modal-title">⚠️ Missing Sheet Tabs</h2>
            <p className="modal-body">
              The following tabs were not found in your Google Sheets data file:{' '}
              <strong>{missingSheetTabs.join(', ')}</strong>.
              They may have been renamed or deleted. Would you like to add them back?
            </p>
            <div className="modal-actions">
              <button className="btn-primary" onClick={handleAddMissingSheetTabs}>
                Add Missing Tabs
              </button>
              <button className="btn-secondary" onClick={() => setMissingSheetTabs(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {spreadsheetNotOnDrive && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 className="modal-title">📄 No Data File Found</h2>
            <p className="modal-body">
              No <strong>BudgetApp Data</strong> spreadsheet was found in your Google Drive.
              Would you like to create one? Your locally saved data will be synced to the new file.
            </p>
            <div className="modal-actions">
              <button className="btn-primary" onClick={handleCreateSpreadsheet}>
                Create Spreadsheet
              </button>
              <button className="btn-secondary" onClick={() => setSpreadsheetNotOnDrive(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
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
            onArchivePeriod={archivePeriod}
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
        {tab === 'archived' && (
          <ArchivedPeriodsPage
            bills={bills}
            settings={settings}
            overrides={periodOverrides}
            creditCards={creditCards}
            onUpdatePeriodOverride={updatePeriodOverride}
            onMoveBill={moveBill}
            onUnmoveBill={unmoveBill}
            onCreditCardPaymentProcessed={handleCreditCardPaymentProcessed}
            onCreditCardPaymentRestored={handleCreditCardPaymentRestored}
            onUnarchivePeriod={unarchivePeriod}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <IconThemeProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </IconThemeProvider>
    </ThemeProvider>
  );
}

