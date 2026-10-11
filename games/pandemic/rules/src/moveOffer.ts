// Moving another player's pawn (the Dispatcher; Airlift in Pandemic 05) is an offer: the pawn's
// owner accepts or declines, and the player who offered can cancel. The action is spent only
// when the owner accepts; while an offer is open nobody does anything else.
import {
  checkAction,
  doPawnMove,
  spendAction,
  type ActionCheck,
  type ActionReason,
} from './actions';
import type { ActionState, GameState, SeatId } from './types';

export type MoveOfferMove =
  { type: 'move-accept' } | { type: 'move-decline' } | { type: 'move-cancel' };

const OK: ActionCheck = { ok: true };
const fail = (reason: ActionReason): ActionCheck => ({ ok: false, reason });

export function checkMoveOffer(state: ActionState, seat: SeatId, move: MoveOfferMove): ActionCheck {
  if (state.status !== 'playing') return fail('game-over');
  const { pending } = state;
  if (pending?.kind !== 'move') return fail('no-offer');
  if (move.type === 'move-cancel') return seat === pending.by ? OK : fail('not-your-turn');
  if (seat !== pending.pawn) return fail('not-your-answer');
  // The move must still be legal as it was offered.
  return move.type === 'move-accept'
    ? checkAction({ ...state, pending: null }, pending.by, pending.move)
    : OK;
}

/** Does the answer (it must be legal: see `checkMoveOffer`) and returns the new state. */
export function applyMoveOffer(state: GameState, seat: SeatId, move: MoveOfferMove): GameState {
  const check = checkMoveOffer(state, seat, move);
  if (!check.ok) throw new Error(`Illegal ${move.type}: ${check.reason}`);

  const s = structuredClone(state);
  const offer = s.pending;
  s.pending = null;
  if (move.type === 'move-accept' && offer?.kind === 'move') {
    doPawnMove(s, offer.by, offer.move);
    spendAction(s.turn);
  }
  return s;
}
