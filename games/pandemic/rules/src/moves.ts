// Every move a player can make, one entry point for the server and the client.
import { applyAction, checkAction, type Action, type ActionCheck } from './actions';
import {
  applyForecastOrder,
  checkForecastOrder,
  type ForecastOrderMove,
  type PlayEventMove,
} from './events';
import { applyMoveOffer, checkMoveOffer, type MoveOfferMove } from './moveOffer';
import { applyPlayEvent, checkPlayEvent } from './playEvent';
import { isPreflightMove, type PreflightMove } from './preflight';
import { applyRoleAction, checkRoleAction, isRoleAction } from './roleActions';
import type { RoleAction } from './roles';
import { applyShare, checkShare, type ShareMove } from './share';
import { applyTurnMove, checkTurnMove, type TurnMove } from './turn';
import type { ActionState, GameState, SeatId } from './types';

export type PandemicMove =
  | Action
  | ShareMove
  | MoveOfferMove
  | TurnMove
  | RoleAction
  | PlayEventMove
  | ForecastOrderMove
  | PreflightMove;

const isShare = (move: PandemicMove): move is ShareMove => move.type.startsWith('share-');
const isMoveOffer = (move: PandemicMove): move is MoveOfferMove => move.type.startsWith('move-');
const isPlayEvent = (move: PandemicMove): move is PlayEventMove => move.type === 'play-event';
const isForecastOrder = (move: PandemicMove): move is ForecastOrderMove =>
  move.type === 'forecast-order';
const isTurn = (move: PandemicMove): move is TurnMove =>
  move.type === 'draw' ||
  move.type === 'epidemic' ||
  move.type === 'infect' ||
  move.type === 'discard';

export function checkMove(state: ActionState, seat: SeatId, move: PandemicMove): ActionCheck {
  // Picking roles and confirming belong to the "before the game" step (`preflight.ts`).
  if (isPreflightMove(move)) return { ok: false, reason: 'wrong-step' };
  if (isPlayEvent(move)) return checkPlayEvent(state, seat, move);
  if (isForecastOrder(move)) return checkForecastOrder(state, seat, move);
  if (isShare(move)) return checkShare(state, seat, move);
  if (isMoveOffer(move)) return checkMoveOffer(state, seat, move);
  if (isTurn(move)) return checkTurnMove(state, seat, move);
  if (isRoleAction(move)) return checkRoleAction(state, seat, move);
  return checkAction(state, seat, move);
}

/** Does the move (it must be legal: see `checkMove`) and returns the new state. */
export function applyMove(state: GameState, seat: SeatId, move: PandemicMove): GameState {
  if (isPreflightMove(move)) throw new Error(`Illegal ${move.type}: wrong-step`);
  if (isPlayEvent(move)) return applyPlayEvent(state, seat, move);
  if (isForecastOrder(move)) return applyForecastOrder(state, seat, move);
  if (isShare(move)) return applyShare(state, seat, move);
  if (isMoveOffer(move)) return applyMoveOffer(state, seat, move);
  if (isTurn(move)) return applyTurnMove(state, seat, move);
  if (isRoleAction(move)) return applyRoleAction(state, seat, move);
  return applyAction(state, seat, move);
}

/**
 * Whether `seat` may make `move` now, read from the seat's own view: the same checks the server
 * runs on the full state (the client uses it to highlight what can be done).
 */
export const canActInView = (view: ActionState, seat: SeatId, move: PandemicMove): boolean =>
  checkMove(view, seat, move).ok;
