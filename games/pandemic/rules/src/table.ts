// The table before the game: players take seats, and once the number the creator chose in the
// lobby is seated (never earlier with fewer) the "before the game" step starts (`preflight.ts`).
import type { ActionCheck } from './actions';
import { beginSetup } from './preflight';
import { SEATS, type PandemicState, type RoleMode, type SeatId, type WaitingState } from './types';

/** A table for `players` players: the "before the game" step starts if they are all seated. */
export function openTable(options: {
  seats: readonly SeatId[];
  players: number;
  epidemics: number;
  roleMode: RoleMode;
  seed: number;
}): PandemicState {
  const { seats, players, epidemics, roleMode, seed } = options;
  if (seats.length >= players) {
    return beginSetup({ seats: [...seats].sort().slice(0, players), epidemics, roleMode, seed });
  }
  return { status: 'waiting', seated: [...seats], players, epidemics, roleMode, seed };
}

/**
 * Whether `seat` may be taken: a free seat while waiting, or (once the game is on) a seat of
 * the game that its player gave up.
 */
export function checkJoin(state: PandemicState, seat: SeatId): ActionCheck {
  if (!SEATS.includes(seat)) return { ok: false, reason: 'bad-seat' };
  // A table for 3 has seats p1 to p3 only.
  const open =
    state.status === 'waiting'
      ? SEATS.indexOf(seat) < state.players &&
        !state.seated.includes(seat) &&
        state.seated.length < state.players
      : state.seats.includes(seat);
  return open ? { ok: true } : { ok: false, reason: 'room-full' };
}

/** A seat is given up: while waiting it is free again; in a game it stays the game's. */
export function seatLeft(state: PandemicState, seat: SeatId): PandemicState {
  if (state.status !== 'waiting') return state;
  return { ...state, seated: state.seated.filter((taken) => taken !== seat) };
}

/** A seat is taken; the last one deals the game. A seat taken over mid-game changes nothing. */
export function seatJoined(state: PandemicState, seat: SeatId): PandemicState {
  if (state.status !== 'waiting') return state;
  const waiting: WaitingState = { ...state, seated: [...state.seated, seat] };
  return openTable({ ...waiting, seats: waiting.seated });
}
