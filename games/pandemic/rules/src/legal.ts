// The actions a seat could take now (for random play, tests and the client's highlights).
import { checkAction, cardsToCure, type Action } from './actions';
import { CITIES, COLORS, cityOf, type CityId } from './cities';
import type { ShareMove } from './share';
import { checkShare } from './share';
import type { GameState, SeatId } from './types';

/** Actions worth trying, legal or not (a superset of `legalActions`). */
export function candidateActions(state: GameState, seat: SeatId): Action[] {
  const here = state.pawns[seat] as CityId;
  const hand = state.hands[seat] ?? [];
  const candidates: Action[] = [{ type: 'pass' }];

  for (const to of cityOf(here).links) candidates.push({ type: 'drive', to });
  for (const to of state.stations) candidates.push({ type: 'shuttle', to });
  for (const { id } of CITIES) {
    candidates.push({ type: 'direct', to: id }, { type: 'charter', to: id });
  }
  candidates.push({ type: 'build' });
  for (const move of state.stations) candidates.push({ type: 'build', move });
  for (const color of COLORS) {
    candidates.push({ type: 'treat', color });
    const cards = hand
      .flatMap((card) => (card.kind === 'city' ? [card.city] : []))
      .filter((card) => cityOf(card).color === color);
    // One way of paying: the first cards of the color (enough to explore the rule).
    candidates.push({ type: 'cure', color, cards: cards.slice(0, cardsToCure()) });
  }
  return candidates;
}

export function legalActions(state: GameState, seat: SeatId): Action[] {
  return candidateActions(state, seat).filter((action) => checkAction(state, seat, action).ok);
}

/** The Share Knowledge offers `seat` could make now. */
export function legalShareOffers(state: GameState, seat: SeatId): ShareMove[] {
  const offers: ShareMove[] = state.seats.flatMap((other) =>
    other === seat
      ? []
      : [
          { type: 'share-offer', direction: 'give', with: other } as const,
          { type: 'share-offer', direction: 'take', with: other } as const,
        ],
  );
  return offers.filter((offer) => checkShare(state, seat, offer).ok);
}
