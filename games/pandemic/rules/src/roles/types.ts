import type { ActionCheck } from '../actions';
import type { CityId, Color } from '../cities';
import type { ActionState, EventId, GameState, RoleId, SeatId } from '../types';

/** A role's own actions (each costs one action of its holder's turn). */
export type RoleAction =
  /** Contingency Planner: take this event card from the discard pile onto the role card. */
  | { type: 'take-event'; event: EventId }
  /** Operations Expert: discard `card` (any city card) at a station and fly to `to`. */
  | { type: 'ops-flight'; to: CityId; card: CityId };

/** The `type`s of every `RoleAction`, so a move can be routed to its role. */
export const ROLE_ACTION_TYPES: readonly string[] = ['ops-flight', 'take-event'];

/**
 * A role card. The core rules call these hooks at fixed points and never test for a role by
 * name; a role that does not change a rule leaves its hook out. `holder` is the seat that holds
 * the role. Hooks that get a `GameState` mutate it (it is already cloned).
 */
export interface RoleModule {
  id: RoleId;
  /** City cards a cure needs, instead of `CARDS_TO_CURE` (Scientist). */
  cardsToCure?: number;
  /** Whether `holder`, on their own turn, may give the card of `city` without both being in it (Researcher). */
  canGive?(state: ActionState, holder: SeatId, city: CityId): boolean;
  /** May move other players' pawns as their own, and any pawn to a city with another (Dispatcher). */
  movesPawns?: boolean;
  /** Builds a research station without discarding the city's card (Operations Expert). */
  buildsWithoutCard?: boolean;
  /** Treat Disease removes every cube of the color, cured or not (Medic). */
  treatsAll?: boolean;
  /** After `holder`'s pawn arrives in a city, however it got there (Medic). */
  onEnterCity?(state: GameState, holder: SeatId): void;
  /** After any player discovers a cure; called for every role in play (Medic). */
  onCure?(state: GameState, holder: SeatId, color: Color): void;
  /** Whether `holder` stops a cube of `color` from being put on `city` (Medic, Quarantine Specialist). */
  preventsCube?(state: GameState, holder: SeatId, city: CityId, color: Color): boolean;
  /** Checks one of the role's own actions; the turn checks (`checkTurnAction`) are done before. */
  checkAction?(state: ActionState, seat: SeatId, action: RoleAction): ActionCheck;
  /** Does one of the role's own actions (it was checked); the action is spent after. */
  applyAction?(state: GameState, seat: SeatId, action: RoleAction): void;
}
