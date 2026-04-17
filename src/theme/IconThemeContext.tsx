import { createContext, useContext, useState, type ReactNode } from 'react';

export type IconThemeId =
  | 'classic'
  | 'nature'
  | 'space'
  | 'sports'
  | 'food'
  | 'music';

export interface IconSet {
  periods: string;
  bills: string;
  creditCards: string;
  settings: string;
  backup: string;
  signOut: string;
  logo: string;
}

export interface IconTheme {
  id: IconThemeId;
  label: string;
  preview: string; // single emoji shown in the picker
  icons: IconSet;
}

export const ICON_THEMES: IconTheme[] = [
  {
    id: 'classic',
    label: 'Classic',
    preview: '📅',
    icons: {
      periods: '📅',
      bills: '🧾',
      creditCards: '💳',
      settings: '⚙️',
      backup: '💾',
      signOut: '👤',
      logo: '💰',
    },
  },
  {
    id: 'nature',
    label: 'Nature',
    preview: '🌿',
    icons: {
      periods: '🌿',
      bills: '🍃',
      creditCards: '🌸',
      settings: '🌻',
      backup: '🌲',
      signOut: '🐾',
      logo: '🍀',
    },
  },
  {
    id: 'space',
    label: 'Space',
    preview: '🚀',
    icons: {
      periods: '🚀',
      bills: '🌙',
      creditCards: '🛸',
      settings: '🔭',
      backup: '💫',
      signOut: '👨‍🚀',
      logo: '🌍',
    },
  },
  {
    id: 'sports',
    label: 'Sports',
    preview: '⚽',
    icons: {
      periods: '⚽',
      bills: '🏀',
      creditCards: '🎾',
      settings: '⚾',
      backup: '🏈',
      signOut: '🏃',
      logo: '🏆',
    },
  },
  {
    id: 'food',
    label: 'Food',
    preview: '🍕',
    icons: {
      periods: '🍕',
      bills: '🧁',
      creditCards: '🍰',
      settings: '🍳',
      backup: '🥡',
      signOut: '👨‍🍳',
      logo: '🍔',
    },
  },
  {
    id: 'music',
    label: 'Music',
    preview: '🎵',
    icons: {
      periods: '🎵',
      bills: '🎸',
      creditCards: '🎹',
      settings: '🎼',
      backup: '🎤',
      signOut: '🎧',
      logo: '🎶',
    },
  },
];

const STORAGE_KEY = 'budgetapp_icon_theme';

function getDefaultTheme(): IconThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as IconThemeId | null;
    return ICON_THEMES.some((t) => t.id === stored) ? stored! : 'classic';
  } catch {
    return 'classic';
  }
}

interface IconThemeContextValue {
  iconThemeId: IconThemeId;
  iconTheme: IconTheme;
  setIconTheme: (id: IconThemeId) => void;
}

const IconThemeContext = createContext<IconThemeContextValue | null>(null);

export function IconThemeProvider({ children }: { children: ReactNode }) {
  const [iconThemeId, setIconThemeId] = useState<IconThemeId>(getDefaultTheme);

  const iconTheme = ICON_THEMES.find((t) => t.id === iconThemeId) ?? ICON_THEMES[0];

  function setIconTheme(id: IconThemeId) {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage unavailable; proceed with in-memory update only
    }
    setIconThemeId(id);
  }

  return (
    <IconThemeContext.Provider value={{ iconThemeId, iconTheme, setIconTheme }}>
      {children}
    </IconThemeContext.Provider>
  );
}

export function useIconTheme(): IconThemeContextValue {
  const ctx = useContext(IconThemeContext);
  if (!ctx) throw new Error('useIconTheme must be used within IconThemeProvider');
  return ctx;
}
