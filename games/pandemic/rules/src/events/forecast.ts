import type { ActionCheck } from '../actions';
import type { CityId } from '../cities';
import type { ActionState, GameState, SeatId } from '../types';
import type { EventModule } from './types';

/** Infection cards Forecast looks at (all that are left, when fewer). */
export const FORECAST_CARDS = 6;

/** Forecast's second step: the cards it took, in their new order, the new top card first. */
export type ForecastOrderMove = { type: 'forecast-order'; cards: CityId[] };

/**
 * Forecast, step one: the top infection cards leave the deck for the player's eyes only (see
 * `viewFor`) until `forecast-order` puts them back. With an empty deck there is nothing to see.
 */
export const forecast: EventModule = {
  id: 'forecast',
  twoSteps: true,
  check: () => ({ ok: true }),
  apply(state, seat) {
    const cards = state.infectionDeck.splice(0, FORECAST_CARDS);
    if (cards.length > 0) state.pending = { kind: 'forecast', seat, count: cards.length, cards };
  },
};

export function checkForecastOrder(
  state: ActionState,
  seat: SeatId,
  move: ForecastOrderMove,
): ActionCheck {
  if (state.status !== 'playing') return { ok: false, reason: 'game-over' };
  const { pending } = state;
  if (pending?.kind !== 'forecast') return { ok: false, reason: 'no-forecast' };
  if (pending.seat !== seat) return { ok: false, reason: 'not-your-answer' };
  // The same cards, each once: infection cards are all different cities.
  const same =
    move.cards.length === pending.cards.length &&
    new Set(move.cards).size === move.cards.length &&
    move.cards.every((city) => pending.cards.includes(city));
  return same ? { ok: true } : { ok: false, reason: 'bad-order' };
}

/** Puts the cards back on top of the infection deck in the new order (it was checked). */
export function applyForecastOrder(
  state: GameState,
  seat: SeatId,
  move: ForecastOrderMove,
): GameState {
  const check = checkForecastOrder(state, seat, move);
  if (!check.ok) throw new Error(`Illegal forecast-order: ${check.reason}`);
  const s = structuredClone(state);
  s.infectionDeck = [...move.cards, ...s.infectionDeck];
  s.pending = null;
  return s;
}
