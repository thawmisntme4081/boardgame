// Optional accounts (Platform 06): who is signed in, and signing in or out. The server answers
// under `/auth/*` and Better Auth's `/api/auth/*`; the session is an httpOnly cookie, so this
// file never sees a token. Guests never need any of it.
import { usePlatform, type AccountUser } from './store';

export type { AccountUser };

export interface SignInMethods {
  google: boolean;
}

const json = { 'content-type': 'application/json' };

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

const post = (path: string, body: unknown) =>
  fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: json,
    body: JSON.stringify(body),
  });

/**
 * Who is signed in, and how one can sign in. Accounts count as off when the server has none
 * (or cannot be reached): then the site shows no sign-in at all.
 */
export async function loadAccount(): Promise<void> {
  const { setAccount } = usePlatform.getState();
  try {
    const [methods, user] = await Promise.all([
      getJson<SignInMethods>('/auth/methods'),
      getJson<AccountUser | null>('/auth/me'),
    ]);
    setAccount(methods.google ? { methods, user } : 'off');
  } catch {
    setAccount('off');
  }
}

/** Google's page, then back to this page signed in (or not, if the player cancels). */
export async function signInWithGoogle(): Promise<boolean> {
  const here = window.location.pathname;
  try {
    const res = await post('/api/auth/sign-in/social', {
      provider: 'google',
      callbackURL: here,
      errorCallbackURL: here,
    });
    const { url } = (await res.json()) as { url?: string };
    if (!res.ok || !url) return false;
    window.location.assign(url);
    return true;
  } catch {
    return false;
  }
}

/** The display name, asked once if Google did not provide one; it cannot change afterwards. */
export async function setAccountName(name: string): Promise<boolean> {
  try {
    const res = await post('/auth/name', { name });
    if (!res.ok) return false;
    const user = (await res.json()) as AccountUser;
    const { account, setAccount } = usePlatform.getState();
    if (account !== 'off' && account !== 'loading') setAccount({ ...account, user });
    return true;
  } catch {
    return false;
  }
}

export async function signOut(): Promise<boolean> {
  try {
    const res = await post('/api/auth/sign-out', {});
    if (!res.ok) return false;
    const { account, setAccount } = usePlatform.getState();
    if (account !== 'off' && account !== 'loading') setAccount({ ...account, user: null });
    return true;
  } catch {
    return false;
  }
}

/** Deletes the account for good (its history, sessions and links); the seats stay as guests'. */
export async function deleteAccount(): Promise<boolean> {
  try {
    const res = await fetch('/api/account', { method: 'DELETE', credentials: 'same-origin' });
    if (!res.ok) return false;
    const { account, setAccount } = usePlatform.getState();
    if (account !== 'off' && account !== 'loading') setAccount({ ...account, user: null });
    return true;
  } catch {
    return false;
  }
}
