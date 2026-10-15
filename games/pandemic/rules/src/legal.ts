// The actions a seat could take now (for random play, tests and the client's highlights).
import { checkAction, cardsToCure, type Action } from './actions';
import { CITIES, COLORS, cityOf, type CityId } from './cities';
import type { ShareMove } from './share';
import { checkShare } from './share';
import { checkRoleAction } from './roleActions';
import { roleOf, type RoleAction } from './roles';
import { EVENT_IDS, type GameState, type SeatId } from './types';

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
  // A role that moves other pawns: every pawn move for each of them, and joins for anyone.
  if (roleOf(state, seat)?.movesPawns) {
    for (const pawn of state.seats) {
      for (const { id: to } of CITIES) candidates.push({ type: 'join', to, pawn });
      if (pawn === seat) continue;
      for (const to of cityOf(state.pawns[pawn] as CityId).links) {
        candidates.push({ type: 'drive', to, pawn });
      }
      for (const to of state.stations) candidates.push({ type: 'shuttle', to, pawn });
      for (const { id: to } of CITIES) {
        candidates.push({ type: 'direct', to, pawn }, { type: 'charter', to, pawn });
      }
    }
  }
  candidates.push({ type: 'build' });
  for (const move of state.stations) candidates.push({ type: 'build', move });
  for (const color of COLORS) {
    candidates.push({ type: 'treat', color });
    const cards = hand
      .flatMap((card) => (card.kind === 'city' ? [card.city] : []))
      .filter((card) => cityOf(card).color === color);
    // One way of paying: the first cards of the color (enough to explore the rule).
    candidates.push({ type: 'cure', color, cards: cards.slice(0, cardsToCure(state, seat)) });
  }
  return candidates;
}

export function legalActions(state: GameState, seat: SeatId): Action[] {
  return candidateActions(state, seat).filter((action) => checkAction(state, seat, action).ok);
}

/** The Share Knowledge offers `seat` could make now (with `city` only for another city's card). */
export function legalShareOffers(state: GameState, seat: SeatId): ShareMove[] {
  const here = state.pawns[seat] as CityId;
  const cityCards = (holder: SeatId): CityId[] =>
    (state.hands[holder] ?? []).flatMap((card) =>
      card.kind === 'city' && card.city !== here ? [card.city] : [],
    );
  const offers: ShareMove[] = state.seats.flatMap((other) =>
    other === seat
      ? []
      : (['give', 'take'] as const).flatMap((direction) => [
          { type: 'share-offer', direction, with: other } as const,
          ...(direction === 'give' ? cityCards(seat) : []).map(
            (city) => ({ type: 'share-offer', direction, with: other, city }) as const,
          ),
        ]),
  );
  return offers.filter((offer) => checkShare(state, seat, offer).ok);
}

/** The role actions `seat` could take now (the Operations Expert's flights). */
export function legalRoleActions(state: GameState, seat: SeatId): RoleAction[] {
  const flights: RoleAction[] = (state.hands[seat] ?? []).flatMap((card) =>
    card.kind === 'city'
      ? CITIES.map(({ id }): RoleAction => ({ type: 'ops-flight', to: id, card: card.city }))
      : [],
  );
  const takes: RoleAction[] = EVENT_IDS.map((event): RoleAction => ({ type: 'take-event', event }));
  return [...flights, ...takes].filter((action) => checkRoleAction(state, seat, action).ok);
}
