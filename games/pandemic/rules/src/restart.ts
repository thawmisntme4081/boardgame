// "Restart turn": until the draw, the active player can take back everything done this turn
// (all the actions, and the event cards they played) and start the turn again.
//
// The game keeps a checkpoint: a copy of itself, taken just before the first move of the turn
// (`withCheckpoint`) and dropped when the cards are drawn or the turn ends. The checkpoint is
// private (views never carry it). A restart puts it back; the next move takes a new one, so a
// restart with nothing done is not possible.
//
// Not allowed once another player played an event card this turn (the card was theirs to play),
// nor while an offer or a discard waits for its answer.
import type { ActionCheck, ActionReason } from './actions';
import type { GameLog } from './log';
import type { ActionState, GameState, SeatId } from './types';

export type RestartMove = { type: 'restart-turn' };

/** A copy of the game, without the checkpoint itself. */
export type Checkpoint = Omit<GameState, 'checkpoint'>;

const OK: ActionCheck = { ok: true };
const fail = (reason: ActionReason): ActionCheck => ({ ok: false, reason });

/** What the checks read: the game, or a player's view (which says `restartable` itself). */
type RestartState = ActionState & { checkpoint?: unknown; restartable?: boolean; log?: GameLog };

/** Another player played an event card in this turn. */
export function othersPlayedEvent(log: GameLog, active: SeatId): boolean {
  return log.current.entries.some((entry) => entry.type === 'event' && entry.seat !== active);
}

/** Whether the active player may restart their turn now (the game, or a view). */
export function isRestartable(state: RestartState): boolean {
  if (state.status !== 'playing' || state.pending) return false;
  if (state.turn.step !== 'actions' && state.turn.step !== 'draw') return false;
  if (state.restartable !== undefined) return state.restartable;
  return (
    state.checkpoint !== null &&
    state.checkpoint !== undefined &&
    state.log !== undefined &&
    !othersPlayedEvent(state.log, state.turn.seat)
  );
}

export function checkRestart(state: ActionState, seat: SeatId): ActionCheck {
  if (state.status !== 'playing') return fail('game-over');
  if (state.turn.seat !== seat) return fail('not-your-turn');
  return isRestartable(state as RestartState) ? OK : fail('cannot-restart');
}

/** Puts the checkpoint back (it was checked); the next move takes a new one. */
export function applyRestart(state: GameState, seat: SeatId): GameState {
  const check = checkRestart(state, seat);
  if (!check.ok) throw new Error(`Illegal restart-turn: ${check.reason}`);
  return { ...structuredClone(state.checkpoint as Checkpoint), checkpoint: null };
}

/**
 * The game as it is, with a checkpoint if this is the first move of a turn's actions: the move
 * is then applied to the returned game. The checkpoint is a copy of the game before the move.
 */
export function withCheckpoint(state: GameState, move: { type: string }): GameState {
  const first =
    state.status === 'playing' &&
    state.checkpoint === null &&
    state.turn.step === 'actions' &&
    state.pending === null &&
    move.type !== 'restart-turn';
  if (!first) return state;
  const { checkpoint: _none, ...copy } = state;
  void _none;
  return { ...state, checkpoint: structuredClone(copy) };
}
