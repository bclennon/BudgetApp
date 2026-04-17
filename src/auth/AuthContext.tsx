import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** The current Google OAuth access token (includes Sheets scope). Null until the user signs in. */
  sheetsToken: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-requests a fresh Google OAuth access token with the Sheets scope. */
  requestSheetsToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
// drive.file is required to search Google Drive for an existing BudgetApp spreadsheet
// so that we can return it instead of creating a duplicate on each new device/session.
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetsToken, setSheetsToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.addScope(SHEETS_SCOPE);
    provider.addScope(DRIVE_FILE_SCOPE);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setSheetsToken(credential.accessToken);
    }
  }

  async function signOut() {
    setSheetsToken(null);
    await firebaseSignOut(auth);
  }

  async function requestSheetsToken(): Promise<string> {
    const provider = new GoogleAuthProvider();
    provider.addScope(SHEETS_SCOPE);
    provider.addScope(DRIVE_FILE_SCOPE);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain Google Sheets access token.');
    }
    setSheetsToken(credential.accessToken);
    return credential.accessToken;
  }

  return (
    <AuthContext.Provider value={{ user, loading, sheetsToken, signInWithGoogle, signOut, requestSheetsToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
