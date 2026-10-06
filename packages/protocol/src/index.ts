// The wire protocol for every game: `room:*` events for the platform (lobby, seats, presence)
// and one envelope for games (`match:move` in, `match:view` out). A game only fills in its own
// seat, move, view and setup types; the events never change from one game to the next.
import { z } from 'zod';

export const ROOM_CODE_LENGTH = 4;

const name = z.string().trim().min(1).max(20);
const code = z
  .string()
  .trim()
  .regex(new RegExp(`^[A-Za-z]{${ROOM_CODE_LENGTH}}$`))
  .transform((c) => c.toUpperCase());
const matchId = z.string().min(1).max(40);

/** Payload schemas: the server checks every incoming event with these. */
export const createRoomSchema = z.object({
  name,
  /** The game's id in the registry (`'sky-team'`). */
  game: z.string().min(1).max(40),
  /** What the creator chose in the lobby; checked by the game. */
  config: z.unknown().optional(),
});
export const joinRoomSchema = z.object({ code, name });
export const rejoinRoomSchema = z.object({ code, token: z.uuid() });
/** Events without data: `{}` or nothing. */
export const emptySchema = z.object({}).optional();
export const chooseSeatSchema = z.object({ seat: z.string().min(1).max(20) });
export const rematchSchema = z.object({
  /** The match the player was looking at: a second "play again" for it changes nothing. */
  matchId,
  /** Changes to the setup for the next match; the rest stays as it was. */
  config: z.unknown().optional(),
});
export const moveSchema = z.object({
  matchId,
  /** The player's own counter: a move with a `seq` already accepted is a harmless repeat. */
  seq: z.number().int().positive(),
  /** Checked by the game's `moveSchema`. */
  move: z.unknown(),
});

/** Platform error codes; a refused move answers with the game's own reason code instead. */
export type PlatformError =
  | 'bad-request'
  | 'room-not-found'
  | 'room-full'
  | 'bad-token'
  | 'not-in-room'
  | 'already-in-room'
  | 'too-many-rooms'
  | 'unknown-game'
  | 'not-creator'
  | 'stale-match'
  | 'game-not-over';

export type JoinResult<Seat extends string = string> =
  | {
      ok: true;
      code: string;
      seat: Seat;
      token: string;
      /** The current match, and the last `seq` the server accepted from this seat in it. */
      matchId: string;
      seq: number;
    }
  | { ok: false; error: PlatformError };

/** `Reason`: the game's own codes for a refused move. */
export type AckResult<Reason extends string = string> =
  { ok: true } | { ok: false; error: PlatformError | Reason };

/** Platform facts about a seat; the game's own (picks, ready…) are in its view. */
export interface SeatInfo {
  name: string;
  online: boolean;
  /** Created the room (or stayed when the creator left): runs the setup. */
  creator: boolean;
}

/**
 * Who sits in each seat (`null` while empty). `you`: the seat of the player it was sent to,
 * so a client can apply it together with the view for that seat (seats can change before
 * the game starts).
 */
export type Presence<Seat extends string = string> = Record<Seat, SeatInfo | null> & {
  you?: Seat;
};

/**
 * One player's view of a match. `version` counts the match's accepted changes: a client keeps
 * the newest it has and drops older ones. Every view is complete, so a missed one loses nothing.
 */
export interface MatchView<View> {
  matchId: string;
  version: number;
  view: View;
}

export interface MovePayload<Move> {
  matchId: string;
  seq: number;
  move: Move;
}

type Empty = Record<string, never>;
type Ack<R> = (result: R) => void;

/** Client → server. `Config`: what the lobby may choose; `Move`: what a player may send. */
export interface ClientEvents<Seat extends string, Move, Config, Reason extends string> {
  'room:create': (
    payload: { name: string; game: string; config?: Config },
    ack: Ack<JoinResult<Seat>>,
  ) => void;
  'room:join': (payload: { code: string; name: string }, ack: Ack<JoinResult<Seat>>) => void;
  'room:rejoin': (payload: { code: string; token: string }, ack: Ack<JoinResult<Seat>>) => void;
  /** Give up your seat for good (closing the tab only marks you offline). */
  'room:leave': (payload: Empty, ack: Ack<AckResult<Reason>>) => void;
  /** Before the game starts: the creator takes `seat`; whoever sat there takes theirs. */
  'room:choose-seat': (payload: { seat: Seat }, ack: Ack<AckResult<Reason>>) => void;
  /** A new match in the same room once this one is over (or before it starts). */
  'room:rematch': (
    payload: { matchId: string; config?: Partial<Config> },
    ack: Ack<AckResult<Reason>>,
  ) => void;
  'match:move': (payload: MovePayload<Move>, ack: Ack<AckResult<Reason>>) => void;
}

/** Server → client. */
export interface ServerEvents<Seat extends string, View> {
  'room:presence': (presence: Presence<Seat>) => void;
  'match:view': (view: MatchView<View>) => void;
}
