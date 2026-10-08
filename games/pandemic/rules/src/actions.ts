// The player actions of a turn: four per turn, and a reason code for every refusal.
import { COLORS, cityOf, type CityId, type Color } from './cities';
import {
  CARDS_TO_CURE,
  MAX_STATIONS,
  type ActionState,
  type GameState,
  type HandCard,
  type SeatId,
  type Turn,
} from './types';

export type Action =
  /** Drive / Ferry: to a city joined by a white line. */
  | { type: 'drive'; to: CityId }
  /** Direct Flight: discard the card of the city you fly to. */
  | { type: 'direct'; to: CityId }
  /** Charter Flight: discard the card of the city you are in, fly anywhere. */
  | { type: 'charter'; to: CityId }
  /** Shuttle Flight: from a station to another station. */
  | { type: 'shuttle'; to: CityId }
  /** Build a Research Station; `move` names the station to take away once all 6 are built. */
  | { type: 'build'; move?: CityId }
  /** Treat Disease: one cube, or all of a cured color. */
  | { type: 'treat'; color: Color }
  /** Discover a Cure: discard these city cards (all of the color) at a research station. */
  | { type: 'cure'; color: Color; cards: CityId[] }
  /** Give up the rest of the actions. */
  | { type: 'pass' };

export type ActionReason =
  | 'game-over'
  | 'not-your-turn'
  | 'wrong-step'
  | 'answer-first'
  | 'no-actions-left'
  | 'same-city'
  | 'not-adjacent'
  | 'card-missing'
  | 'no-station'
  | 'station-exists'
  | 'bad-station-to-move'
  | 'no-cubes'
  | 'already-cured'
  | 'bad-cards'
  // Share Knowledge (see share.ts)
  | 'bad-partner'
  | 'not-together'
  | 'no-offer'
  | 'not-your-answer'
  // Turn steps (see turn.ts)
  | 'nothing-to-discard';

export type ActionCheck = { ok: true } | { ok: false; reason: ActionReason };

const OK: ActionCheck = { ok: true };
const fail = (reason: ActionReason): ActionCheck => ({ ok: false, reason });

export const hasCityCard = (hand: readonly HandCard[] | undefined, city: CityId): boolean =>
  (hand ?? []).some((card) => card.kind === 'city' && card.city === city);

/** Cubes of a color on the whole map. */
export function cubesOnBoard(state: Pick<GameState, 'cubes'>, color: Color): number {
  let total = 0;
  for (const cubes of Object.values(state.cubes)) total += cubes[color];
  return total;
}

/** City cards needed to discover a cure (the Scientist needs fewer, in Pandemic 04). */
export const cardsToCure = (): number => CARDS_TO_CURE;

export function checkAction(state: ActionState, seat: SeatId, action: Action): ActionCheck {
  if (state.status !== 'playing') return fail('game-over');
  if (state.turn.seat !== seat) return fail('not-your-turn');
  if (state.pending) return fail('answer-first');
  if (state.turn.step !== 'actions') return fail('wrong-step');
  if (state.turn.actionsLeft <= 0) return fail('no-actions-left');

  const here = state.pawns[seat] as CityId;
  const hand = state.hands[seat];
  switch (action.type) {
    case 'pass':
      return OK;
    case 'drive':
      if (action.to === here) return fail('same-city');
      return cityOf(here).links.includes(action.to) ? OK : fail('not-adjacent');
    case 'direct':
      if (action.to === here) return fail('same-city');
      return hasCityCard(hand, action.to) ? OK : fail('card-missing');
    case 'charter':
      if (action.to === here) return fail('same-city');
      return hasCityCard(hand, here) ? OK : fail('card-missing');
    case 'shuttle':
      if (action.to === here) return fail('same-city');
      return state.stations.includes(here) && state.stations.includes(action.to)
        ? OK
        : fail('no-station');
    case 'build':
      if (state.stations.includes(here)) return fail('station-exists');
      if (!hasCityCard(hand, here)) return fail('card-missing');
      if (state.stations.length >= MAX_STATIONS) {
        return action.move !== undefined && state.stations.includes(action.move)
          ? OK
          : fail('bad-station-to-move');
      }
      return action.move === undefined ? OK : fail('bad-station-to-move');
    case 'treat':
      return state.cubes[here][action.color] > 0 ? OK : fail('no-cubes');
    case 'cure': {
      if (!state.stations.includes(here)) return fail('no-station');
      if (state.cures[action.color] !== 'none') return fail('already-cured');
      const needed = cardsToCure();
      const valid =
        new Set(action.cards).size === needed &&
        action.cards.length === needed &&
        action.cards.every(
          (card) => cityOf(card).color === action.color && hasCityCard(hand, card),
        );
      return valid ? OK : fail('bad-cards');
    }
  }
}

/** Takes one card of a city out of a hand and onto the player discard pile. */
function discardCity(state: GameState, seat: SeatId, city: CityId): void {
  const hand = state.hands[seat] as HandCard[];
  const index = hand.findIndex((card) => card.kind === 'city' && card.city === city);
  state.playerDiscard.push(...hand.splice(index, 1));
}

/** Spends one action; with none left, the actions part of the turn is over. */
export function spendAction(turn: Turn): void {
  turn.actionsLeft -= 1;
  if (turn.actionsLeft <= 0) turn.step = 'draw';
}

/** Eradicated: cured, and no cube of the color left on the map. */
function checkEradicated(state: GameState, color: Color): void {
  if (state.cures[color] === 'cured' && cubesOnBoard(state, color) === 0) {
    state.cures[color] = 'eradicated';
  }
}

/** Does the action (it must be legal: see `checkAction`) and returns the new state. */
export function applyAction(state: GameState, seat: SeatId, action: Action): GameState {
  const check = checkAction(state, seat, action);
  if (!check.ok) throw new Error(`Illegal action ${action.type}: ${check.reason}`);

  const s = structuredClone(state);
  const here = s.pawns[seat] as CityId;
  switch (action.type) {
    case 'pass':
      s.turn.actionsLeft = 0;
      s.turn.step = 'draw';
      return s;
    case 'drive':
    case 'shuttle':
      s.pawns[seat] = action.to;
      break;
    case 'direct':
      discardCity(s, seat, action.to);
      s.pawns[seat] = action.to;
      break;
    case 'charter':
      discardCity(s, seat, here);
      s.pawns[seat] = action.to;
      break;
    case 'build':
      discardCity(s, seat, here);
      if (action.move !== undefined) s.stations = s.stations.filter((c) => c !== action.move);
      s.stations.push(here);
      break;
    case 'treat': {
      const cubes = s.cubes[here];
      const removed = s.cures[action.color] === 'none' ? 1 : cubes[action.color];
      cubes[action.color] -= removed;
      s.supply[action.color] += removed;
      checkEradicated(s, action.color);
      break;
    }
    case 'cure':
      for (const card of action.cards) discardCity(s, seat, card);
      s.cures[action.color] = 'cured';
      checkEradicated(s, action.color);
      if (COLORS.every((color) => s.cures[color] !== 'none')) s.status = 'won';
      break;
  }
  spendAction(s.turn);
  return s;
}
