// Discover a Cure, and the helped cure: a role with `cureHelp` (the Z-Force Team Member) may use
// up to that many cards of other players in its city (a player is there if any of their pawns
// is, as for Share Knowledge). A helped cure is an offer: every helper whose card is used accepts,
// in any order; one decline calls it off; the player who cures can cancel. The action is spent
// when the last helper accepts.
import {
  cardsToCure,
  checkAction,
  checkEradicated,
  discardCity,
  hasCityCard,
  spendAction,
  type ActionCheck,
  type ActionReason,
} from './actions';
import { COLORS, cityOf, type CityId, type Color } from './cities';
import { actingPawn, pawnsOf } from './pawns';
import { roleOf, rolesInPlay } from './roles';
import type { ActionState, GameState, SeatId } from './types';

/** A card another player gives toward a cure. */
export interface CureHelp {
  seat: SeatId;
  city: CityId;
}

/** Discover a Cure: the player's `cards`, and `help` from other players (a role with `cureHelp`). */
export type CureAction = { type: 'cure'; color: Color; cards: CityId[]; help?: CureHelp[] };

export type CureOfferMove =
  { type: 'cure-accept' } | { type: 'cure-decline' } | { type: 'cure-cancel' };

const OK: ActionCheck = { ok: true };
const fail = (reason: ActionReason): ActionCheck => ({ ok: false, reason });

/** Cards of `seat`'s cures other players may give, at most (0 without the role). */
export const cureHelpOf = (state: Pick<ActionState, 'roles'>, seat: SeatId): number =>
  roleOf(state, seat)?.cureHelp ?? 0;

/** The players who give cards to a cure, each once, in the order of their cards. */
export const helpersOf = (action: CureAction): SeatId[] => [
  ...new Set((action.help ?? []).map((help) => help.seat)),
];

/** A cure by `seat`, the turn checks aside: at a station in its city, with the right cards. */
export function checkCure(state: ActionState, seat: SeatId, action: CureAction): ActionCheck {
  const here = state.pawns[actingPawn(state, seat)] as CityId;
  if (!state.stations.includes(here)) return fail('no-station');
  if (state.cures[action.color] !== 'none') return fail('already-cured');
  const help = action.help ?? [];
  if (help.length > cureHelpOf(state, seat)) return fail('wrong-role');
  for (const { seat: helper } of help) {
    if (helper === seat || !state.seats.includes(helper)) return fail('bad-partner');
    if (!pawnsOf(state, helper).some((pawn) => state.pawns[pawn] === here)) {
      return fail('not-together');
    }
  }
  const cities = [...action.cards, ...help.map(({ city }) => city)];
  const needed = cardsToCure(state, seat);
  const valid =
    cities.length === needed &&
    new Set(cities).size === needed &&
    cities.every((city) => cityOf(city).color === action.color) &&
    action.cards.every((card) => hasCityCard(state.hands[seat], card)) &&
    help.every(({ seat: helper, city }) => hasCityCard(state.hands[helper], city));
  return valid ? OK : fail('bad-cards');
}

/** Discovers the cure (it was checked): the cards go, every role reacts, maybe the game is won. */
export function discoverCure(s: GameState, seat: SeatId, action: CureAction): void {
  for (const card of action.cards) discardCity(s, seat, card);
  for (const { seat: helper, city } of action.help ?? []) discardCity(s, helper, city);
  s.cures[action.color] = 'cured';
  for (const { seat: holder, role } of rolesInPlay(s)) role.onCure?.(s, holder, action.color);
  checkEradicated(s, action.color);
  if (COLORS.every((color) => s.cures[color] !== 'none')) s.status = 'won';
}

export function checkCureOffer(state: ActionState, seat: SeatId, move: CureOfferMove): ActionCheck {
  if (state.status !== 'playing') return fail('game-over');
  const { pending } = state;
  if (pending?.kind !== 'cure') return fail('no-offer');
  if (move.type === 'cure-cancel') return seat === pending.by ? OK : fail('not-your-turn');
  if (!pending.waiting.includes(seat)) return fail('not-your-answer');
  if (move.type === 'cure-decline') return OK;
  // The cure must still be legal as it was offered.
  return checkAction({ ...state, pending: null }, pending.by, pending.move);
}

/** Does the answer (it must be legal: see `checkCureOffer`) and returns the new state. */
export function applyCureOffer(state: GameState, seat: SeatId, move: CureOfferMove): GameState {
  const check = checkCureOffer(state, seat, move);
  if (!check.ok) throw new Error(`Illegal ${move.type}: ${check.reason}`);
  const s = structuredClone(state);
  const offer = s.pending;
  if (offer?.kind !== 'cure') return s;
  if (move.type !== 'cure-accept') {
    s.pending = null;
    return s;
  }
  const waiting = offer.waiting.filter((helper) => helper !== seat);
  if (waiting.length > 0) {
    s.pending = { ...offer, waiting };
    return s;
  }
  s.pending = null;
  discoverCure(s, offer.by, offer.move);
  spendAction(s.turn);
  return s;
}
