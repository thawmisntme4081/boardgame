// The crew's choices: who flies which seat, the Special Ability picks and the confirms before
// round 1, and "ready" in each strategy phase. The platform seats the players; these rules
// decide what the seated players may choose.
import { beginGame, otherSeat, rollDice, startRoundTimer } from './rules';
import {
  SEATS,
  type AbilityId,
  type Crew,
  type GameState,
  type MoveCheck,
  type Seat,
} from './types';

const OK: MoveCheck = { ok: true };
const fail = (reason: Extract<MoveCheck, { ok: false }>['reason']): MoveCheck => ({
  ok: false,
  reason,
});
const both = <T>(value: T): Record<Seat, T> => ({ pilot: value, copilot: value });

export function freshCrew(host: Seat = 'pilot', seated: Record<Seat, boolean> = both(true)): Crew {
  return {
    host,
    seated: { ...seated },
    rolesChosen: false,
    picks: both(null),
    confirmed: both(false),
    ready: both(false),
  };
}

/**
 * The Special Abilities the picks make: with two cards, each player's own; with one, the
 * host's. Fewer than the scenario allows until everyone has picked.
 */
export function pickedAbilities(state: Pick<GameState, 'scenario' | 'crew'>): AbilityId[] {
  const count = state.scenario.abilities;
  const { crew } = state;
  const seats = (count === 1 ? [crew.host] : SEATS).filter((seat) => crew.seated[seat]);
  const picks = seats.map((seat) => crew.picks[seat]).filter((pick) => pick !== null);
  return [...new Set(picks)].slice(0, count);
}

/** The choices changed: the cards follow the picks, and every confirm is canceled. */
function resync(state: GameState): void {
  state.abilities = pickedAbilities(state);
  state.crew.confirmed = both(false);
  state.crew.ready = both(false);
}

/** Before round 1, rolling needs every Special Ability card chosen. */
export const abilitiesChosen = (state: GameState): boolean =>
  state.abilities.length === state.scenario.abilities;

const setupOpen = (state: GameState): MoveCheck =>
  state.phase === 'setup' ? OK : fail('setup-closed');

export function canPickAbility(state: GameState, seat: Seat, ability: AbilityId | null): MoveCheck {
  const open = setupOpen(state);
  if (!open.ok) return open;
  const count = state.scenario.abilities;
  if (count === 0 || (count === 1 && seat !== state.crew.host)) return fail('not-your-pick');
  if (ability !== null && count === 2 && state.crew.picks[otherSeat(seat)] === ability) {
    return fail('ability-taken');
  }
  return OK;
}

/** Before round 1: pick (or, with `null`, take back) your Special Ability card. */
export function pickAbility(state: GameState, seat: Seat, ability: AbilityId | null): GameState {
  const s = structuredClone(state);
  s.crew.picks[seat] = ability;
  resync(s);
  return s;
}

/** The host may choose the seats until round 1 starts. */
export const canChooseSeat = setupOpen;

/**
 * Before round 1: the host takes `seat`, and the partner (now or later) the other one; the
 * picks go along with the players. Either way the roles now count as chosen.
 */
export function chooseSeat(state: GameState, seat: Seat): GameState {
  const s = structuredClone(state);
  const { crew } = s;
  if (seat !== crew.host) {
    crew.picks = { pilot: crew.picks.copilot, copilot: crew.picks.pilot };
    crew.seated = { pilot: crew.seated.copilot, copilot: crew.seated.pilot };
    crew.host = seat;
  }
  crew.rolesChosen = true;
  resync(s);
  return s;
}

/** Someone took the free seat. */
export function seatJoined(state: GameState, seat: Seat): GameState {
  const s = structuredClone(state);
  s.crew.seated[seat] = true;
  return s;
}

export function canConfirm(state: GameState): MoveCheck {
  const open = setupOpen(state);
  if (!open.ok) return open;
  if (!SEATS.every((seat) => state.crew.seated[seat])) return fail('no-partner');
  if (!state.crew.rolesChosen) return fail('roles-missing');
  if (!abilitiesChosen(state)) return fail('abilities-missing');
  return OK;
}

/**
 * Before round 1: this player is happy with the roles and abilities. Once both have
 * confirmed, round 1 starts: the traffic die rolls and the strategy discussion begins.
 */
export function confirm(state: GameState, seat: Seat): GameState {
  const s = structuredClone(state);
  s.crew.confirmed[seat] = true;
  if (!SEATS.every((other) => s.crew.confirmed[other])) return s;
  s.crew.confirmed = both(false);
  return beginGame(s);
}

export const canBeReady = (state: GameState): MoveCheck =>
  state.phase === 'strategy' ? OK : fail('not-strategy');

/**
 * The strategy discussion is over for this player. Once both are ready the dice roll, and in
 * a timed game the round's countdown starts at `now`.
 */
export function ready(state: GameState, seat: Seat, now: number): GameState {
  const s = structuredClone(state);
  s.crew.ready[seat] = true;
  if (!SEATS.every((other) => s.crew.ready[other])) return s;
  return startRoundTimer(rollDice(s), now);
}
