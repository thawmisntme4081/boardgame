// Socket.IO protocol shared by server and client: a renamed event breaks the build.
import type { AbilityAction, AbilityId, MoveError, PlaceIntent, Seat } from './types';
import type { PlayerView } from './views';

export type ErrorCode =
  | 'bad-request'
  | 'room-not-found'
  | 'room-full'
  | 'bad-token'
  | 'not-in-room'
  | 'already-in-room'
  | 'not-strategy'
  | 'game-not-over'
  | 'too-many-rooms'
  // Before round 1: roles and Special Abilities.
  | 'setup-closed'
  | 'not-your-pick'
  | 'ability-taken'
  | 'abilities-missing'
  | 'no-partner'
  | 'not-creator'
  | 'roles-missing';

export type JoinResult =
  { ok: true; code: string; seat: Seat; token: string } | { ok: false; error: ErrorCode };

/** Room errors, or the rule that rejected a move (see `MoveError`). */
export type AckResult = { ok: true } | { ok: false; error: ErrorCode | MoveError };

export interface PlayerInfo {
  name: string;
  online: boolean;
  /** Ready to roll: the strategy discussion is over for this player. */
  ready: boolean;
  /** Created the game: picks the card when the scenario allows only one Special Ability. */
  creator: boolean;
  /** Before round 1: the Special Ability card this player picked. */
  pick: AbilityId | null;
  /** Before round 1: the creator has chosen who flies which seat. */
  rolesChosen: boolean;
  /** Before round 1: this player confirmed the roles and abilities. */
  confirmed: boolean;
}

/**
 * Who sits in each seat; `null` while the seat is empty. `you`: the seat of the player it
 * was sent to, so a client can apply it together with the view for that seat (seats can
 * change before round 1).
 */
export type Presence = Record<Seat, PlayerInfo | null> & { you?: Seat };

/** Which Flight Log scenario to fly (roles and Special Abilities are chosen in the game). */
export interface GameSetup {
  /** Scenario id (`SCENARIOS`); YUL when absent. */
  scenario?: string;
}

/** Before round 1: pick a Special Ability card (`null` takes yours back). */
export interface PickAbilityPayload {
  ability: AbilityId | null;
}

/** Before round 1: the seat the creator takes (the partner gets the other one). */
export interface ChooseSeatPayload {
  seat: Seat;
}

export interface CreateRoomPayload extends GameSetup {
  name: string;
  /** Timed game: each round must be placed within the round timer (default off). */
  timer?: boolean;
}
export interface JoinRoomPayload {
  code: string;
  name: string;
}
export interface RejoinRoomPayload {
  code: string;
  token: string;
}
export interface RerollPayload {
  dieIds: string[];
}
type Empty = Record<string, never>;

export interface ClientToServer {
  'room:create': (payload: CreateRoomPayload, ack: (result: JoinResult) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (result: JoinResult) => void) => void;
  'room:rejoin': (payload: RejoinRoomPayload, ack: (result: JoinResult) => void) => void;
  /** Give up your seat for good (closing the tab only marks you offline). */
  'room:leave': (payload: Empty, ack: (result: AckResult) => void) => void;
  'game:ready': (payload: Empty, ack: (result: AckResult) => void) => void;
  /** Before round 1: pick your Special Ability card. */
  'game:pick-ability': (payload: PickAbilityPayload, ack: (result: AckResult) => void) => void;
  /** Before round 1: the creator chooses their seat. */
  'room:choose-seat': (payload: ChooseSeatPayload, ack: (result: AckResult) => void) => void;
  /** Before round 1: roles and abilities are fine; round 1 starts once both confirm. */
  'game:confirm': (payload: Empty, ack: (result: AckResult) => void) => void;
  'game:place': (payload: PlaceIntent, ack: (result: AckResult) => void) => void;
  /** Spend a reroll token: both players may then reroll once. */
  'game:spend-reroll': (payload: Empty, ack: (result: AckResult) => void) => void;
  'game:reroll': (payload: RerollPayload, ack: (result: AckResult) => void) => void;
  /** Use Adaptation, Anticipation or Working Together (offer a die, or answer an offer). */
  'game:ability': (payload: AbilityAction, ack: (result: AckResult) => void) => void;
  /**
   * New game in the same room once this one is over; may switch scenario. Before the first
   * roll it just switches the scenario (a repeat of the current setup is accepted, no change).
   */
  'game:rematch': (payload: GameSetup, ack: (result: AckResult) => void) => void;
}

export interface ServerToClient {
  'game:view': (view: PlayerView) => void;
  'room:presence': (presence: Presence) => void;
}
