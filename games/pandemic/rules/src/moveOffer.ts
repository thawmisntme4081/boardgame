// Moving another player's pawn (the Dispatcher, or the Airlift event card) is an offer: the
// pawn's owner accepts or declines, and the player who offered can cancel. The action is spent
// (or the card played) only when the owner accepts; while an offer is open nobody does anything
// else. A pawn that takes things along (`carry.ts`) chooses them when accepting; a pawn taken
// along is one more offer, to its owner, before the move happens.
import {
  checkAction,
  doPawnMove,
  spendAction,
  type ActionCheck,
  type ActionReason,
} from './actions';
import { answeringPawn, carriesAlong, checkCarry, type Carry } from './carry';
import { actingPawn } from './pawns';
import { checkPlayEvent, resolveEvent } from './playEvent';
import {
  pawnOwner,
  type ActionState,
  type GameState,
  type PawnId,
  type Pending,
  type SeatId,
} from './types';

export type MoveOfferMove =
  /** `carry`: what the moved pawn takes along, chosen by its owner (a pawn that `carries`). */
  { type: 'move-accept'; carry?: Carry } | { type: 'move-decline' } | { type: 'move-cancel' };

type OfferedMove = Extract<Pending, { kind: 'move' }>['move'];

const OK: ActionCheck = { ok: true };
const fail = (reason: ActionReason): ActionCheck => ({ ok: false, reason });

/** The pawn an offered move moves. */
export const offeredPawn = (
  state: Pick<ActionState, 'turn'>,
  by: SeatId,
  move: OfferedMove,
): PawnId => move.pawn ?? actingPawn(state, by);

/** The move without what it takes along: as its mover made it. */
function bare(move: OfferedMove): OfferedMove {
  const copy = { ...move };
  delete copy.carry;
  return copy;
}

/**
 * Whether the answer to an open move offer may take things along: the moved pawn's owner
 * answers, its pawn `carries`, and nothing was chosen yet.
 */
export function canCarryOnAccept(state: ActionState): boolean {
  const { pending } = state;
  if (pending?.kind !== 'move' || pending.move.carry !== undefined) return false;
  const pawn = offeredPawn(state, pending.by, pending.move);
  return pending.pawn === pawn && carriesAlong(state, pawn);
}

export function checkMoveOffer(state: ActionState, seat: SeatId, move: MoveOfferMove): ActionCheck {
  if (state.status !== 'playing') return fail('game-over');
  const { pending } = state;
  if (pending?.kind !== 'move') return fail('no-offer');
  if (move.type === 'move-cancel') return seat === pending.by ? OK : fail('not-your-turn');
  if (seat !== pawnOwner(pending.pawn)) return fail('not-your-answer');
  if (move.type !== 'move-accept') return OK;
  if (move.carry && !canCarryOnAccept(state)) return fail('wrong-role');
  // The move must still be legal as it was offered (an action, or an event card still held),
  // and what it takes along (chosen now or before) still there.
  const before = { ...state, pending: null };
  const offered = bare(pending.move);
  const check =
    offered.type === 'play-event'
      ? checkPlayEvent(before, pending.by, offered)
      : checkAction(before, pending.by, offered);
  const carry = move.carry ?? pending.move.carry;
  if (!check.ok || carry === undefined) return check;
  return checkCarry(before, offeredPawn(state, pending.by, pending.move), carry);
}

/** Does the answer (it must be legal: see `checkMoveOffer`) and returns the new state. */
export function applyMoveOffer(state: GameState, seat: SeatId, move: MoveOfferMove): GameState {
  const check = checkMoveOffer(state, seat, move);
  if (!check.ok) throw new Error(`Illegal ${move.type}: ${check.reason}`);

  const s = structuredClone(state);
  const offer = s.pending;
  s.pending = null;
  if (move.type !== 'move-accept' || offer?.kind !== 'move') return s;
  const offered: OfferedMove = move.carry ? { ...offer.move, carry: move.carry } : offer.move;
  // A pawn taken along that is someone else's: its owner agrees next.
  const next = move.carry?.pawn !== undefined ? answeringPawn(seat, seat, move.carry) : null;
  if (next !== null) {
    s.pending = { kind: 'move', by: offer.by, pawn: next, move: offered };
  } else if (offered.type === 'play-event') {
    // An event card: played now, and not an action.
    resolveEvent(s, offer.by, offered);
  } else {
    doPawnMove(s, offer.by, offered);
    spendAction(s.turn);
  }
  return s;
}
