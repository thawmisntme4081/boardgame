// Share Knowledge: the active player offers to give or take the card of the city both players
// are in (a role may allow another city card: `canGive`); the partner accepts or declines; the
// active player can cancel. The action is spent only when the partner accepts. The active player
// is where the pawn chosen for the turn is (`actingPawn`); the partner is in every city one of its
// pawns is in (a Teacher's student counts as the Teacher).
import type { ActionCheck, ActionReason } from './actions';
import { checkTurnAction, hasCityCard, spendAction } from './actions';
import type { CityId } from './cities';
import { actingPawn, pawnsOf } from './pawns';
import { roleOf } from './roles';
import { HAND_LIMIT, type ActionState, type GameState, type HandCard, type SeatId } from './types';

export type ShareMove =
  /**
   * The active player offers to give the card to, or take it from, `with`: the card of the city
   * they are in, or, when giving, another `city` the giver's role allows (Researcher).
   */
  | { type: 'share-offer'; direction: 'give' | 'take'; with: SeatId; city?: CityId }
  | { type: 'share-accept' }
  | { type: 'share-decline' }
  | { type: 'share-cancel' };

const OK: ActionCheck = { ok: true };
const fail = (reason: ActionReason): ActionCheck => ({ ok: false, reason });

/** The seat that has to answer an open offer: the one who is not the active player. */
export function shareAnswerer(state: ActionState): SeatId | null {
  const { pending } = state;
  if (pending?.kind !== 'share') return null;
  return pending.from === state.turn.seat ? pending.to : pending.from;
}

export function checkShare(state: ActionState, seat: SeatId, move: ShareMove): ActionCheck {
  if (state.status !== 'playing') return fail('game-over');

  if (move.type !== 'share-offer') {
    const { pending } = state;
    if (pending?.kind !== 'share') return fail('no-offer');
    if (move.type === 'share-cancel') {
      return seat === state.turn.seat ? OK : fail('not-your-turn');
    }
    return seat === shareAnswerer(state) ? OK : fail('not-your-answer');
  }

  const turn = checkTurnAction(state, seat);
  if (!turn.ok) return turn;
  if (move.with === seat || !state.seats.includes(move.with)) return fail('bad-partner');
  const here = state.pawns[actingPawn(state, seat)] as CityId;
  if (!pawnsOf(state, move.with).some((pawn) => state.pawns[pawn] === here)) {
    return fail('not-together');
  }
  const giver = move.direction === 'give' ? seat : move.with;
  const city = move.city ?? here;
  // Another city's card can only be given (by the active player), never taken.
  if (city !== here && (giver !== seat || !roleOf(state, giver)?.canGive?.(state, giver, city))) {
    return fail('wrong-role');
  }
  return hasCityCard(state.hands[giver], city) ? OK : fail('card-missing');
}

/** Does the move (it must be legal: see `checkShare`) and returns the new state. */
export function applyShare(state: GameState, seat: SeatId, move: ShareMove): GameState {
  const check = checkShare(state, seat, move);
  if (!check.ok) throw new Error(`Illegal ${move.type}: ${check.reason}`);

  const s = structuredClone(state);
  if (move.type === 'share-offer') {
    const city = move.city ?? (s.pawns[actingPawn(s, seat)] as CityId);
    s.pending =
      move.direction === 'give'
        ? { kind: 'share', from: seat, to: move.with, city }
        : { kind: 'share', from: move.with, to: seat, city };
    return s;
  }

  const offer = s.pending;
  s.pending = null;
  if (move.type !== 'share-accept' || offer?.kind !== 'share') return s;

  const from = s.hands[offer.from] as HandCard[];
  const index = from.findIndex((card) => card.kind === 'city' && card.city === offer.city);
  const to = s.hands[offer.to] as HandCard[];
  to.push(...from.splice(index, 1));
  spendAction(s.turn);
  if (to.length > HAND_LIMIT) s.pending = { kind: 'discard', seat: offer.to };
  return s;
}
