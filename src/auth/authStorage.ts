const KEY_USER = 'budgetapp_user';

export interface GoogleUser {
  name: string;
  email: string;
  picture: string;
}

export function loadUser(): GoogleUser | null {
  try {
    const raw = localStorage.getItem(KEY_USER);
    return raw ? (JSON.parse(raw) as GoogleUser) : null;
  } catch (err) {
    console.warn('budgetapp: failed to load user from localStorage, clearing stored value.', err);
    localStorage.removeItem(KEY_USER);
    return null;
  }
}

export function saveUser(user: GoogleUser): void {
  localStorage.setItem(KEY_USER, JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem(KEY_USER);
}
