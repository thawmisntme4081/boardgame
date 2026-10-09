// The table before the game: players take seats, and the game is dealt once the number the
// creator chose in the lobby is seated (never earlier with fewer).
import type { ActionCheck } from './actions';
import { createGame } from './setup';
import { SEATS, type PandemicState, type SeatId, type WaitingState } from './types';

/** A table for `players` players: the game is dealt at once if they are all seated. */
export function openTable(options: {
  seats: readonly SeatId[];
  players: number;
  epidemics: number;
  seed: number;
}): PandemicState {
  const { seats, players, epidemics, seed } = options;
  if (seats.length >= players) {
    // The seats in a fixed order, so the deal does not depend on who sat down first.
    return createGame({ seats: [...seats].sort().slice(0, players), epidemics, seed });
  }
  return { status: 'waiting', seated: [...seats], players, epidemics, seed };
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
