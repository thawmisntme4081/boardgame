// Optional accounts (Platform 06): who is signed in, and signing in or out. The server answers
// under `/auth/*` and Better Auth's `/api/auth/*`; the session is an httpOnly cookie, so this
// file never sees a token. Guests never need any of it.
import { usePlatform, type AccountUser } from './store';

export type { AccountUser };

export interface SignInMethods {
  google: boolean;
  email: boolean;
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
    setAccount(methods.google || methods.email ? { methods, user } : 'off');
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

export type CodeResult = 'ok' | 'too-many-tries' | 'wrong-code' | 'unknown';

const failure = (status: number): Exclude<CodeResult, 'ok'> =>
  status === 429 ? 'too-many-tries' : status === 400 ? 'wrong-code' : 'unknown';

/** Emails a 6-digit sign-in code. */
export async function sendSignInCode(email: string): Promise<CodeResult> {
  try {
    const res = await post('/api/auth/email-otp/send-verification-otp', { email, type: 'sign-in' });
    return res.ok ? 'ok' : res.status === 429 ? 'too-many-tries' : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Signs in with the emailed code; the account is created on first use (without a name). */
export async function signInWithCode(email: string, otp: string): Promise<CodeResult> {
  try {
    const res = await post('/api/auth/sign-in/email-otp', { email, otp });
    if (!res.ok) return failure(res.status);
    await loadAccount();
    return 'ok';
  } catch {
    return 'unknown';
  }
}

/** The display name, asked once after an email sign-in; it cannot change afterwards. */
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
