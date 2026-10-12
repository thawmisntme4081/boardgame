// Moving another player's pawn (the Dispatcher, or the Airlift event card) is an offer: the
// pawn's owner accepts or declines, and the player who offered can cancel. The action is spent
// (or the card played) only when the owner accepts; while an offer is open nobody does anything
// else.
import {
  checkAction,
  doPawnMove,
  spendAction,
  type ActionCheck,
  type ActionReason,
} from './actions';
import { checkPlayEvent, resolveEvent } from './playEvent';
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
  if (move.type !== 'move-accept') return OK;
  // The move must still be legal as it was offered (an action, or an event card still held).
  const before = { ...state, pending: null };
  return pending.move.type === 'play-event'
    ? checkPlayEvent(before, pending.by, pending.move)
    : checkAction(before, pending.by, pending.move);
}

/** Does the answer (it must be legal: see `checkMoveOffer`) and returns the new state. */
export function applyMoveOffer(state: GameState, seat: SeatId, move: MoveOfferMove): GameState {
  const check = checkMoveOffer(state, seat, move);
  if (!check.ok) throw new Error(`Illegal ${move.type}: ${check.reason}`);

  const s = structuredClone(state);
  const offer = s.pending;
  s.pending = null;
  if (move.type === 'move-accept' && offer?.kind === 'move') {
    if (offer.move.type === 'play-event') {
      // An event card: played now, and not an action.
      resolveEvent(s, offer.by, offer.move);
    } else {
      doPawnMove(s, offer.by, offer.move);
      spendAction(s.turn);
    }
  }
  return s;
}
