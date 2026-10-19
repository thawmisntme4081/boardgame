import type { ActionCheck } from '../actions';
import type { Carry } from '../carry';
import type { CityId } from '../cities';
import type { ActionState, EventId, GameState, PawnId, SeatId } from '../types';

/** What the player chooses when playing each event card. */
export type EventPlay =
  /**
   * Move any pawn to any city (another player's pawn: its owner agrees first); `carry`: what a
   * player's own pawn takes along (Relocation Specialist).
   */
  | { event: 'airlift'; pawn: PawnId; to: CityId; carry?: Carry }
  /** See the top 6 infection cards, then put them back in any order (two steps). */
  | { event: 'forecast' }
  /** A research station in any city; `move` names the one taken away once all 6 are built. */
  | { event: 'government-grant'; city: CityId; move?: CityId }
  /** Skip the next infect step. */
  | { event: 'one-quiet-night' }
  /** Remove this card of the infection discard pile from the game. */
  | { event: 'resilient-population'; city: CityId };

/**
 * Playing an event card, from a hand or the Contingency Planner's role card (the player's own,
 * or another player's: hands are open and anyone may play any card). Not an action.
 */
export type PlayEventMove = {
  type: 'play-event';
  /** Whose card it is, if not the player's own: any player may play any player's event card. */
  owner?: SeatId;
} & EventPlay;

/**
 * An event that moves a pawn. On another player's pawn it is an offer, like the Dispatcher's
 * moves: the card stays in hand until the pawn's owner accepts.
 */
export type PawnEventMove = Extract<PlayEventMove, { pawn: PawnId; to: CityId }>;

/**
 * An event card's effect. The core (`playEvent.ts`) checks when events may be played and that the
 * player holds the card, then calls these hooks; it never tests for an event by name. Hooks that
 * get a `GameState` mutate it (it is already cloned, and the card already left the hand).
 */
export interface EventModule {
  id: EventId;
  /**
   * Also playable in an epidemic's pause, between its Infect and Intensify steps, when no other
   * event may be played (Resilient Population).
   */
  inEpidemicPause?: boolean;
  /**
   * Leaves a step for its player to finish (Forecast's new order), so it cannot be played while
   * something else is pending (a hand-limit discard).
   */
  twoSteps?: boolean;
  /** Checks the player's choices (targets); the moment and the card are checked before. */
  check(state: ActionState, seat: SeatId, play: EventPlay): ActionCheck;
  /** Does the event (it was checked). */
  apply(state: GameState, seat: SeatId, play: EventPlay): void;
}
