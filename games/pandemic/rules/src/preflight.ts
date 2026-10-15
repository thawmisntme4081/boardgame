// The "before the game" step: once every seat is taken, the turn order is drawn and the roles
// dealt at random (the rulebook) or picked by the players, each a role nobody else has; when
// everyone has confirmed (a confirm can be taken back until then), the board is dealt with that
// order and those roles.
import type { ActionCheck, ActionReason } from './actions';
import { createGame, shuffle } from './setup';
import {
  ROLE_IDS,
  type GameState,
  type PerSeat,
  type RoleId,
  type RoleMode,
  type SeatId,
  type SetupState,
} from './types';

export type PreflightMove =
  /** Choose mode: take this role (another free one may be picked until confirming). */
  | { type: 'pick-role'; role: RoleId }
  /** Ready to play with the role you have; the last confirm deals the game. */
  | { type: 'confirm' }
  /** Takes the confirm back (until the last player confirms and the game is dealt). */
  | { type: 'unconfirm' };

export const isPreflightMove = (move: { type: string }): move is PreflightMove =>
  move.type === 'pick-role' || move.type === 'confirm' || move.type === 'unconfirm';

const OK: ActionCheck = { ok: true };
const fail = (reason: ActionReason): ActionCheck => ({ ok: false, reason });

/** Starts the step for the seated players: the turn order, and the roles in random mode. */
export function beginSetup(options: {
  seats: readonly SeatId[];
  epidemics: number;
  roleMode: RoleMode;
  seed: number;
}): SetupState {
  const { epidemics, roleMode, seed } = options;
  // The seats in a fixed order first, so the draw does not depend on who sat down first.
  const order = shuffle([...options.seats].sort(), seed);
  const picks: PerSeat<RoleId> = {};
  if (roleMode === 'random') {
    const deal = shuffle(ROLE_IDS, order.rngState);
    order.items.forEach((seat, i) => (picks[seat] = deal.items[i]));
  }
  return { status: 'setup', seats: order.items, epidemics, roleMode, picks, confirmed: [], seed };
}

/** What the checks read: the step's state, or a player's view of it (the client's copy). */
export type PreflightState = Pick<SetupState, 'seats' | 'roleMode' | 'picks' | 'confirmed'>;

export function checkPreflight(
  state: PreflightState,
  seat: SeatId,
  move: PreflightMove,
): ActionCheck {
  if (!state.seats.includes(seat)) return fail('bad-seat');
  if (move.type === 'unconfirm') {
    return state.confirmed.includes(seat) ? OK : fail('not-confirmed');
  }
  if (state.confirmed.includes(seat)) return fail('already-confirmed');
  if (move.type === 'confirm') return state.picks[seat] ? OK : fail('pick-first');
  if (state.roleMode !== 'choose') return fail('roles-dealt');
  if (!ROLE_IDS.includes(move.role)) return fail('wrong-role');
  const taken = state.seats.some((other) => other !== seat && state.picks[other] === move.role);
  return taken ? fail('role-taken') : OK;
}

/** Does the move (it must be legal); the last confirm returns the dealt game. */
export function applyPreflight(
  state: SetupState,
  seat: SeatId,
  move: PreflightMove,
): SetupState | GameState {
  const check = checkPreflight(state, seat, move);
  if (!check.ok) throw new Error(`Illegal ${move.type}: ${check.reason}`);
  if (move.type === 'pick-role') {
    return { ...state, picks: { ...state.picks, [seat]: move.role } };
  }
  if (move.type === 'unconfirm') {
    return { ...state, confirmed: state.confirmed.filter((other) => other !== seat) };
  }
  const confirmed = [...state.confirmed, seat];
  if (confirmed.length < state.seats.length) return { ...state, confirmed };
  return createGame({
    seats: state.seats,
    epidemics: state.epidemics,
    seed: state.seed,
    ordered: true,
    roles: state.picks,
  });
}
