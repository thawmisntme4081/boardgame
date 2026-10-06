/** What a player needs to get their seat back after a reload or a dropped connection. */
export interface Session {
  code: string;
  /** The room's game (its id in the registry). */
  game: string;
  token: string;
  seat: string;
  name: string;
}

/** Sessions saved before the platform knew several games were all Sky Team rooms. */
const DEFAULT_GAME = 'sky-team';

const SESSION_KEY = 'sky-team:session';
const NAME_KEY = 'sky-team:name';

// Storage can be missing or throw (private mode, blocked site data): never let that break play.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Ignore: the game still works, it just can't resume after a reload.
  }
}

export function loadSession(): Session | null {
  const raw = read(SESSION_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<Session>;
    return s.code && s.token && s.seat && s.name
      ? { ...(s as Session), game: s.game ?? DEFAULT_GAME }
      : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  write(SESSION_KEY, session && JSON.stringify(session));
  if (session) write(NAME_KEY, session.name);
}

export const loadName = (): string => read(NAME_KEY) ?? '';

/** `/r/ABCD` invite links. */
export function codeFromPath(pathname: string): string {
  return /^\/r\/([A-Za-z]{4})\/?$/.exec(pathname)?.[1]?.toUpperCase() ?? '';
}

export const inviteUrl = (code: string): string => `${window.location.origin}/r/${code}`;
