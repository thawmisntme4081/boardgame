// Everything that talks to the server, for every game: the site gate, rooms, presence and the
// match envelope. A game's screens send their moves through `platformServices.send`.
import type { AckResult, JoinResult } from '@platform/protocol';
import type { PlatformApi } from '@platform/ui/game';
import i18n from '@platform/ui/i18n';
import { toast } from 'sonner';
import { loadedGame, loadGame, provideServices } from './games';
import { errorText } from './messages';
import { createPartnerNotifier } from './presence';
import { inviteUrl, saveSession } from './session';
import { socket } from './socket';
import { usePlatform } from './store';

const t = i18n.getFixedT(null, 'platform');
const ACK_TIMEOUT_MS = 5000;

async function withTimeout<R>(request: () => Promise<R>): Promise<R | null> {
  try {
    return await request();
  } catch {
    toast.error(t('toast.noAnswer'));
    return null;
  }
}

const emit = () => socket.timeout(ACK_TIMEOUT_MS);

/**
 * The match on screen: its id, the newest view version seen, and the last move counter this
 * client used (it only goes up, so a reload or a new match never reuses one).
 */
const match = { id: null as string | null, version: -1, seq: 0 };

/** Requests still waiting for their ack, so a double tap does not send a second one. */
const pending = new Set<string>();

const currentGame = () => usePlatform.getState().session?.game;

/** Shows the error for a failed ack; true when the server accepted the request. */
async function run(key: string, request: () => Promise<AckResult>): Promise<boolean> {
  if (pending.has(key)) return false;
  pending.add(key);
  try {
    const result = await withTimeout(request);
    if (result && !result.ok) toast.error(errorText(result.error, currentGame()));
    return result?.ok ?? false;
  } finally {
    pending.delete(key);
  }
}

/** Where the router takes the player (set by the router once it exists). */
let navigate: (path: string) => void = (path) => {
  if (window.location.pathname !== path) window.history.replaceState(null, '', path);
};
export function setNavigate(to: (path: string) => void): void {
  navigate = to;
}

let started = false;

/**
 * The site password gate: whether this browser may connect (always, when the server has no
 * password). A network failure counts as open: the server still refuses the socket.
 */
export async function checkSiteAccess(): Promise<boolean> {
  try {
    const res = await fetch('/auth/status', { credentials: 'same-origin' });
    const data = (await res.json()) as { ok?: boolean };
    return data.ok !== false;
  } catch {
    return true;
  }
}

export type PasswordResult = 'ok' | 'wrong-password' | 'too-many-tries' | 'unknown';

/** Sends the site password; a correct one sets the site cookie (kept 30 days, renewed). */
export async function enterSitePassword(password: string): Promise<PasswordResult> {
  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (data.ok) return 'ok';
    return data.error === 'wrong-password' || data.error === 'too-many-tries'
      ? data.error
      : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Wires socket events into the store and connects. Safe to call more than once. */
export function startConnection(): void {
  if (started) {
    if (!socket.connected) socket.connect();
    return;
  }
  started = true;
  const store = usePlatform.getState;

  socket.on('connect', () => {
    store().setConnection('online');
    // The saved seat first; signed in without one, the seat the account holds.
    void rejoin().then(resumeByAccount);
  });
  socket.on('disconnect', () => store().setConnection('offline'));
  // Refused by the site password (a new password, an expired cookie): ask for it again
  // instead of retrying forever.
  socket.on('connect_error', () => {
    void checkSiteAccess().then((ok) => {
      if (ok) return;
      socket.disconnect();
      store().setSiteAccess('locked');
    });
  });
  socket.io.on('reconnect_attempt', () => store().setConnection('connecting'));
  socket.on('match:view', (envelope) => {
    // Views are complete, so only the newest counts: an older one of the same match is dropped.
    if (envelope.matchId === match.id && envelope.version < match.version) return;
    match.id = envelope.matchId;
    match.version = envelope.version;
    const { session, match: before, presence } = store();
    // Seats can be swapped before the game starts: keep the saved seat in step.
    if (session && session.seat !== envelope.seat) {
      const moved = { ...session, seat: envelope.seat };
      saveSession(moved);
      store().setSession(moved);
    }
    // The game's own state follows the view before it is shown.
    const game = session && loadedGame(session.game);
    const sameMatch = before?.matchId === envelope.matchId;
    game?.onView?.(envelope.view, sameMatch ? before.view : null, presence);
    store().setMatch(envelope);
  });
  // A rematch offer waits in the store; the board shows it to the partner.
  socket.on('room:rematch-offer', (offer) => store().setRematch(offer));
  const onPartner = createPartnerNotifier((text) => toast.message(text));
  socket.on('room:presence', (presence) => {
    const { presence: before, session } = store();
    if (session) onPartner(before, presence, session.seat);
    store().setPresence(presence);
  });

  // Phones pause background tabs; when ours comes back, reconnect or resync the seat.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (socket.connected) void rejoin();
    else socket.connect();
  });

  socket.connect();
}

/** Takes the saved seat back after a reload, a reconnect or the tab returning. */
async function rejoin(): Promise<void> {
  const session = usePlatform.getState().session;
  if (!session) return;
  // The game's module first, so its views can be shown as soon as they arrive.
  await loadGame(session.game).catch(() => undefined);
  const result = await withTimeout(() =>
    emit().emitWithAck('room:rejoin', { code: session.code, token: session.token }),
  );
  if (result?.ok) followMatch(result);
  if (result && !result.ok) {
    toast.error(errorText(result.error));
    forgetSession();
  }
}

/** The signed-in user's id, `null` signed out, `undefined` while accounts are unknown. */
function signedInUser(): string | null | undefined {
  const { account } = usePlatform.getState();
  return typeof account === 'object' ? (account.user?.id ?? null) : undefined;
}

/**
 * Signed in on a device with no saved seat (another device, a cleared browser): back to the
 * seat the account holds, if any. Nothing to resume is not an error.
 */
async function resumeByAccount(): Promise<void> {
  const { session, account } = usePlatform.getState();
  if (session || !signedInUser() || !socket.connected || pending.has('resume')) return;
  pending.add('resume');
  try {
    const result = await withTimeout(() => emit().emitWithAck('room:resume', {}));
    if (!result?.ok) return;
    const name = typeof account === 'object' ? (account.user?.name ?? '') : '';
    await onJoined(result, name);
  } finally {
    pending.delete('resume');
  }
}

/** The account last seen (`undefined`: not loaded yet). */
let lastUser: string | null | undefined;

/**
 * The account was loaded, or changed (signed in or out on this page). The socket learns its
 * account at the handshake, so a change reconnects it: the rejoin then links a guest's seat to
 * the account, or the account's seat is resumed.
 */
export function accountChanged(): void {
  const user = signedInUser();
  if (user === undefined || user === lastUser) return;
  const first = lastUser === undefined;
  lastUser = user;
  if (first) void resumeByAccount();
  else if (started) socket.disconnect().connect();
}

/** A join or rejoin names the current match and the last move counter the seat used. */
function followMatch(result: Extract<JoinResult, { ok: true }>): void {
  if (result.matchId !== match.id) {
    match.id = result.matchId;
    match.version = -1;
  }
  match.seq = Math.max(match.seq, result.seq);
}

async function onJoined(result: JoinResult | null, name: string): Promise<boolean> {
  if (!result) return false;
  if (!result.ok) {
    toast.error(errorText(result.error));
    return false;
  }
  await loadGame(result.game).catch(() => undefined);
  followMatch(result);
  const session = {
    code: result.code,
    game: result.game,
    token: result.token,
    seat: result.seat,
    name,
  };
  saveSession(session);
  usePlatform.getState().setSession(session);
  navigate(`/r/${result.code}`);
  return true;
}

/** Creates a room for `game` with the lobby's choices (`config`, checked by the game). */
export async function createRoom(name: string, game: string, config: unknown): Promise<boolean> {
  await loadGame(game).catch(() => undefined);
  const result = await withTimeout(() => emit().emitWithAck('room:create', { name, game, config }));
  return onJoined(result, name);
}

export async function joinRoom(code: string, name: string): Promise<boolean> {
  const result = await withTimeout(() => emit().emitWithAck('room:join', { code, name }));
  return onJoined(result, name);
}

function forgetSession(): void {
  match.id = null;
  match.version = -1;
  const game = currentGame();
  if (game) loadedGame(game)?.reset?.();
  saveSession(null);
  usePlatform.getState().leave();
  // Back to the game's own page, ready to play again (or the picker if it is unknown).
  navigate(game ? `/play/${game}` : '/');
}

/** Gives up the seat for good and goes back to the game's page. */
export async function leaveGame(): Promise<void> {
  let left = false;
  try {
    left = (await emit().emitWithAck('room:leave', {})).ok;
  } catch {
    // Offline: fall through and drop the connection instead.
  }
  forgetSession();
  // If the server did not hear us, a fresh connection at least stops us counting as seated.
  if (!left) socket.disconnect().connect();
}

export async function shareInvite(code: string): Promise<void> {
  const url = inviteUrl(code);
  if (navigator.share) {
    try {
      await navigator.share({ title: t('app.title'), text: t('toast.shareText'), url });
      return;
    } catch {
      // Canceled or unsupported: fall back to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success(t('toast.inviteCopied'));
  } catch {
    toast.message(url);
  }
}

/** What every game module gets from the shell: its only way to the server. */
export const platformServices: PlatformApi<unknown, unknown> = {
  /**
   * A move for the match on screen, with this client's next move counter: a resend of the
   * same request (after a reconnect) carries the same `seq`, so the server applies it once.
   */
  send: (move) => {
    const type = (move as { type?: unknown }).type;
    return run(`move:${String(type)}`, () =>
      emit().emitWithAck('match:move', { matchId: match.id ?? '', seq: ++match.seq, move }),
    );
  },
  chooseSeat: (seat) => run('choose-seat', () => emit().emitWithAck('room:choose-seat', { seat })),
  rematch: (setup) =>
    run('rematch', () =>
      emit().emitWithAck('room:rematch', {
        matchId: match.id ?? '',
        ...(setup !== undefined && { config: setup as object }),
      }),
    ),
  declineRematch: () =>
    run('rematch-decline', () =>
      emit().emitWithAck('room:rematch-decline', { matchId: match.id ?? '' }),
    ),
  leave: leaveGame,
  signedIn: () => {
    const { account } = usePlatform.getState();
    return typeof account === 'object' && account.user !== null;
  },
  importFlightLog: async (game, records) => {
    if (!platformServices.signedIn()) return false;
    try {
      const res = await fetch('/api/flight-log/import', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ game, records }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
  flightLog: async (game) => {
    if (!platformServices.signedIn()) return null;
    try {
      const res = await fetch(`/api/flight-log?game=${encodeURIComponent(game)}`, {
        credentials: 'same-origin',
      });
      return res.ok ? ((await res.json()) as unknown[]) : null;
    } catch {
      return null;
    }
  },
};

provideServices(platformServices);
