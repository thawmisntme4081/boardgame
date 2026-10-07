import type { Connection, SeatPresence } from '@platform/ui/game';
import { create } from 'zustand';
import { loadSession, type Session } from './session';

export type { Connection };
export type SiteAccess = 'checking' | 'locked' | 'open';

/** The signed-in user (Platform 06), as `GET /auth/me` returns it. */
export interface AccountUser {
  id: string;
  /** Empty after a first email sign-in, until the player chooses it (once). */
  name: string;
  email: string;
  image: string | null;
}

/**
 * Accounts: being loaded, off on this server, or on (with how one signs in, and the user when
 * signed in).
 */
export type AccountState =
  'loading' | 'off' | { methods: { google: boolean; email: boolean }; user: AccountUser | null };

/** The latest view of the match, as the server sent it: any game's, for one seat. */
export interface MatchViewState {
  matchId: string;
  version: number;
  seat: string;
  view: unknown;
}

/**
 * The platform's state: the connection, the seat this browser holds, and the latest match view
 * and presence. A game keeps its own UI state in its own store.
 */
export interface PlatformStore {
  connection: Connection;
  session: Session | null;
  match: MatchViewState | null;
  presence: SeatPresence | null;
  /** Presence sent for a seat this client does not show yet: applied with the matching view. */
  pendingPresence: SeatPresence | null;
  /** The site password gate: being checked, waiting for the password, or open. */
  siteAccess: SiteAccess;
  account: AccountState;

  setConnection: (connection: Connection) => void;
  setSession: (session: Session | null) => void;
  setMatch: (match: MatchViewState) => void;
  setPresence: (presence: SeatPresence) => void;
  setSiteAccess: (siteAccess: SiteAccess) => void;
  setAccount: (account: AccountState) => void;
  leave: () => void;
}

export const usePlatform = create<PlatformStore>()((set) => ({
  connection: 'connecting',
  session: loadSession(),
  match: null,
  presence: null,
  pendingPresence: null,
  siteAccess: 'checking',
  account: 'loading',

  setConnection: (connection) => set({ connection }),
  setSession: (session) => set({ session }),
  setMatch: (match) =>
    set((s) => {
      const pending = s.pendingPresence?.you === match.seat ? s.pendingPresence : null;
      return { match, ...(pending && { presence: pending, pendingPresence: null }) };
    }),
  // Seats can change before the game starts: presence for a new seat waits for that seat's
  // view, so "you" and "your partner" never point at the same player for a moment.
  setPresence: (presence) =>
    set((s) =>
      presence.you && s.match && presence.you !== s.match.seat
        ? { pendingPresence: presence }
        : { presence, pendingPresence: null },
    ),
  setSiteAccess: (siteAccess) => set({ siteAccess }),
  setAccount: (account) => set({ account }),
  leave: () => set({ session: null, match: null, presence: null, pendingPresence: null }),
}));
