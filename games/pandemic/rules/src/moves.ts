// Every move a player can make, one entry point for the server and the client.
import { applyAction, checkAction, type Action, type ActionCheck } from './actions';
import { applyShare, checkShare, type ShareMove } from './share';
import { applyTurnMove, checkTurnMove, type TurnMove } from './turn';
import type { ActionState, GameState, SeatId } from './types';

export type PandemicMove = Action | ShareMove | TurnMove;

const isShare = (move: PandemicMove): move is ShareMove => move.type.startsWith('share-');
const isTurn = (move: PandemicMove): move is TurnMove =>
  move.type === 'draw' ||
  move.type === 'epidemic' ||
  move.type === 'infect' ||
  move.type === 'discard';

export function checkMove(state: ActionState, seat: SeatId, move: PandemicMove): ActionCheck {
  if (isShare(move)) return checkShare(state, seat, move);
  if (isTurn(move)) return checkTurnMove(state, seat, move);
  return checkAction(state, seat, move);
}

/** Does the move (it must be legal: see `checkMove`) and returns the new state. */
export function applyMove(state: GameState, seat: SeatId, move: PandemicMove): GameState {
  if (isShare(move)) return applyShare(state, seat, move);
  if (isTurn(move)) return applyTurnMove(state, seat, move);
  return applyAction(state, seat, move);
}

/**
 * Whether `seat` may make `move` now, read from the seat's own view: the same checks the server
 * runs on the full state (the client uses it to highlight what can be done).
 */
export const canActInView = (view: ActionState, seat: SeatId, move: PandemicMove): boolean =>
  checkMove(view, seat, move).ok;
