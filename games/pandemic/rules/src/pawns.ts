// The pawn a player acts with. Every seat has its own pawn; a role may add more (the Teacher's
// students). A seat with several chooses at the start of its turn which one does the turn's
// actions (`choose-pawn`, not an action); the choice holds until the turn ends. A seat with one
// pawn never chooses: its turn starts with it.
import type { ActionCheck, ActionReason } from './actions';
import {
  pawnOwner,
  pawnsOnMap,
  type ActionState,
  type GameState,
  type PawnId,
  type SeatId,
} from './types';

export type ChoosePawnMove = { type: 'choose-pawn'; pawn: PawnId };

const OK: ActionCheck = { ok: true };
const fail = (reason: ActionReason): ActionCheck => ({ ok: false, reason });

/** The pawns `seat` owns: its own first, then the others in the order they were added. */
export const pawnsOf = (state: Pick<ActionState, 'pawns'>, seat: SeatId): PawnId[] =>
  pawnsOnMap(state).filter((pawn) => pawnOwner(pawn) === seat);

/** The pawn a turn of `seat` starts with: its own, or `null` when it owns several and chooses. */
export const startingPawn = (state: Pick<ActionState, 'pawns'>, seat: SeatId): PawnId | null =>
  pawnsOf(state, seat).length > 1 ? null : seat;

/** The pawn `seat` acts with: the one chosen for its turn, else (out of turn) its own. */
export const actingPawn = (state: Pick<ActionState, 'turn'>, seat: SeatId): PawnId =>
  (state.turn.seat === seat ? state.turn.pawn : null) ?? seat;

export function checkChoosePawn(
  state: ActionState,
  seat: SeatId,
  move: ChoosePawnMove,
): ActionCheck {
  if (state.status !== 'playing') return fail('game-over');
  if (state.turn.seat !== seat) return fail('not-your-turn');
  if (state.pending) return fail('answer-first');
  if (state.turn.step !== 'actions') return fail('wrong-step');
  if (state.turn.pawn !== null) return fail('pawn-chosen');
  return pawnsOf(state, seat).includes(move.pawn) ? OK : fail('not-your-pawn');
}

/** Fixes the pawn for the turn (it must be legal: see `checkChoosePawn`) and returns the new state. */
export function applyChoosePawn(state: GameState, seat: SeatId, move: ChoosePawnMove): GameState {
  const check = checkChoosePawn(state, seat, move);
  if (!check.ok) throw new Error(`Illegal choose-pawn: ${check.reason}`);
  const s = structuredClone(state);
  s.turn.pawn = move.pawn;
  return s;
}
