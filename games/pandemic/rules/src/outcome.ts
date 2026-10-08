// How a game ended: the players win together, or lose together for one reason.
import type { Outcome } from '@platform/engine';
import type { GameState } from './types';

/** `null` while the game is still being played. */
export function outcome(state: GameState): Outcome | null {
  if (state.status === 'won') return { kind: 'coop', won: true, reasons: [] };
  if (state.status === 'lost') {
    return { kind: 'coop', won: false, reasons: state.lossReason ? [state.lossReason] : [] };
  }
  return null;
}
