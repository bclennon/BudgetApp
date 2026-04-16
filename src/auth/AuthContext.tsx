import { createContext, useState, type ReactNode } from 'react';
import type { GoogleUser } from './authStorage';
import { loadUser, saveUser, clearUser } from './authStorage';

export interface AuthContextValue {
  user: GoogleUser | null;
  signIn: (user: GoogleUser) => void;
  signOut: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(() => loadUser());

  function signIn(u: GoogleUser) {
    saveUser(u);
    setUser(u);
  }

  function signOut() {
    clearUser();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
