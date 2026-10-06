// Everything that talks to the server. Components call these; only the server changes the game.
import {
  SKY_TEAM,
  SLOTS,
  type AbilityAction,
  type AbilityId,
  type AckResult,
  type GameSetup,
  type JoinResult,
  type PlayerMove,
  type SlotId,
  type Seat,
} from '@sky/shared';
import { toast } from 'sonner';
import { t } from './i18n';
import { recordFor } from './lib/history';
import { errorText } from './messages';
import { createPartnerNotifier } from './partner';
import { inviteUrl, saveSession } from './session';
import { socket } from './socket';
import { useGame } from './store';

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

/** Shows the error for a failed ack; true when the server accepted the request. */
async function run(key: string, request: () => Promise<AckResult>): Promise<boolean> {
  if (pending.has(key)) return false;
  pending.add(key);
  try {
    const result = await withTimeout(request);
    if (result && !result.ok) toast.error(errorText(result.error));
    return result?.ok ?? false;
  } finally {
    pending.delete(key);
  }
}

function setUrl(path: string): void {
  if (window.location.pathname !== path) window.history.replaceState(null, '', path);
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
  const store = useGame.getState;

  socket.on('connect', () => {
    store().setConnection('online');
    void rejoin();
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
  socket.on('match:view', ({ matchId, version, view }) => {
    // Views are complete, so only the newest counts: an older one of the same match is dropped.
    if (matchId === match.id && version < match.version) return;
    match.id = matchId;
    match.version = version;
    // Seats can be swapped before round 1: keep the saved seat in step.
    const { session } = store();
    if (session && session.seat !== view.seat) {
      const moved = { ...session, seat: view.seat };
      saveSession(moved);
      store().setSession(moved);
    }
    // A game that just ended goes into this device's history (once).
    const { view: before, presence } = store();
    const record = recordFor(before, view, presence, Date.now());
    if (record) store().addRecord(record);
    store().setView(view);
  });
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
  const session = useGame.getState().session;
  if (!session) return;
  const result = await withTimeout(() =>
    emit().emitWithAck('room:rejoin', { code: session.code, token: session.token }),
  );
  if (result?.ok) followMatch(result);
  if (result && !result.ok) {
    toast.error(errorText(result.error));
    forgetSession();
  }
}

/** A join or rejoin names the current match and the last move counter the seat used. */
function followMatch(result: Extract<JoinResult, { ok: true }>): void {
  if (result.matchId !== match.id) {
    match.id = result.matchId;
    match.version = -1;
  }
  match.seq = Math.max(match.seq, result.seq);
}

function onJoined(result: JoinResult | null, name: string): boolean {
  if (!result) return false;
  if (!result.ok) {
    toast.error(errorText(result.error));
    return false;
  }
  followMatch(result);
  const session = { code: result.code, token: result.token, seat: result.seat, name };
  saveSession(session);
  useGame.getState().setSession(session);
  setUrl(`/r/${result.code}`);
  return true;
}

/**
 * Creates a game on the chosen scenario; `timer` makes every round a countdown (lose when
 * it runs out).
 */
export async function createRoom(
  name: string,
  timer = false,
  setup: GameSetup = {},
): Promise<boolean> {
  const result = await withTimeout(() =>
    emit().emitWithAck('room:create', { name, game: SKY_TEAM, config: { ...setup, timer } }),
  );
  return onJoined(result, name);
}

export async function joinRoom(code: string, name: string): Promise<boolean> {
  const result = await withTimeout(() => emit().emitWithAck('room:join', { code, name }));
  return onJoined(result, name);
}

/**
 * Sends a move for the match on screen, with this client's next move counter: a resend of the
 * same request (after a reconnect) carries the same `seq`, so the server applies it once.
 */
const sendMove = (key: string, move: PlayerMove) =>
  run(key, () =>
    emit().emitWithAck('match:move', { matchId: match.id ?? '', seq: ++match.seq, move }),
  );

export const ready = () => sendMove('ready', { type: 'ready' });

/** Before round 1: pick your Special Ability card (`null` takes it back). */
export const pickAbility = (ability: AbilityId | null) =>
  sendMove('pick-ability', { type: 'pick-ability', ability });

/** Before round 1: the creator takes a seat (the partner gets the other). */
export const chooseSeat = (seat: Seat) =>
  run('choose-seat', () => emit().emitWithAck('room:choose-seat', { seat }));

/** Before round 1: confirm roles and abilities; round 1 starts once both have. */
export const confirmSetup = () => sendMove('confirm', { type: 'confirm' });

/**
 * Places the selected die, with its draft coffee, on `slot`. An Intern space takes two
 * taps: the first picks it, the second says where its token goes.
 */
export async function placeSelected(slot: SlotId): Promise<boolean> {
  const { selectedDieId, coffeeDelta, internSlot, setInternSlot } = useGame.getState();
  if (!selectedDieId) return false;
  if (!internSlot && SLOTS[slot].group === 'intern') {
    setInternSlot(slot);
    return true;
  }
  const intent = internSlot
    ? { dieId: selectedDieId, slot: internSlot, coffeeDelta, tokenSlot: slot }
    : { dieId: selectedDieId, slot, coffeeDelta };
  return sendMove('place', { type: 'place', ...intent });
}

/** Adaptation, Anticipation or Working Together, on one of your dice. */
export const playAbility = (action: AbilityAction) =>
  sendMove('ability', { type: 'ability', ...action });

/** Working Together: take back your offer before your partner answers. */
export const cancelSwap = () => sendMove('cancel-swap', { type: 'cancel-swap' });

export const spendReroll = () => sendMove('spend-reroll', { type: 'spend-reroll' });

export function reroll(dieIds: string[]): Promise<boolean> {
  return sendMove('reroll', { type: 'reroll', dieIds });
}

/** A new game in the same room: the same scenario, or the one in `setup`. */
export const rematch = (setup: GameSetup = {}) =>
  run('rematch', () =>
    emit().emitWithAck('room:rematch', { matchId: match.id ?? '', config: setup }),
  );

function forgetSession(): void {
  match.id = null;
  match.version = -1;
  saveSession(null);
  useGame.getState().leave();
  setUrl('/');
}

/** Gives up the seat for good and goes back to the lobby. */
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
      await navigator.share({ title: 'Sky Team', text: t('toast.shareText'), url });
      return;
    } catch {
      // Cancelled or unsupported: fall back to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success(t('toast.inviteCopied'));
  } catch {
    toast.message(url);
  }
}
