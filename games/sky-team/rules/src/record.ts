// One finished game from a player's point of view: the Flight Log's entry. The client keeps it
// on the device (a guest) and the server keeps it per account; both build it here.
import { isGameOver } from './rules';
import type { AbilityId, EndReason, Seat } from './types';
import type { PlayerView } from './views';

export interface GameRecord {
  /** Format version, so an import can read old records. */
  v: 1;
  scenario: string;
  seat: Seat;
  partner: string;
  abilities: AbilityId[];
  result: 'won' | 'lost';
  reasons: EndReason[];
  rounds: number;
  /** When it ended (ms since epoch). */
  at: number;
}

/** The record of a finished game, or `null` while it goes on. */
export function recordOf(view: PlayerView, partner: string, at: number): GameRecord | null {
  if (!isGameOver(view)) return null;
  return {
    v: 1,
    scenario: view.scenario.id,
    seat: view.seat,
    partner,
    abilities: [...view.abilities],
    result: view.phase === 'won' ? 'won' : 'lost',
    reasons: view.landingFailures ?? (view.endReason ? [view.endReason] : []),
    rounds: view.round,
    at,
  };
}
