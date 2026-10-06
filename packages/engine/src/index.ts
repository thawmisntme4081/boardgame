// The game contract: what a board game gives the platform. The platform (rooms, seats,
// sockets, storage) depends only on this; each game implements it with pure functions.
import type { ZodType } from 'zod';

export { nextRandom, randomSeed } from './rng';

/** A seat at the table, named by the game: 'pilot', 'copilot', 'p1'… */
export type SeatId = string;
/** Who a view is for: a seated player, or someone watching. */
export type Viewer = SeatId | 'spectator';
/** Who makes a move: a seated player, or the platform itself (timers, rolls). */
export type Mover = SeatId | 'system';

/** Whether a move is allowed, and if not, a code (never a sentence) saying why. */
export type Result = { ok: true } | { ok: false; reason: string };

/** Who may act now, and how. */
export type Actor =
  /** An ordinary turn. */
  | { seat: SeatId; kind: 'turn' }
  /** Everyone chooses at once and in secret (Isle of Skye's prices, a reroll in Sky Team). */
  | { seat: SeatId; kind: 'simultaneous'; committed: boolean }
  /** An answer is needed from this seat in the middle of someone's turn. */
  | { seat: SeatId; kind: 'prompt'; prompt: string };

/** A move the platform must make later, as the system: a timer running out, an auto-roll. */
export interface ScheduledMove<M> {
  /** When, in ms since the epoch. */
  at: number;
  move: M;
}

/** How a finished game ended. */
export type Outcome =
  /** Cooperative: everyone wins or loses together; `reasons` are codes. */
  | { kind: 'coop'; won: boolean; reasons: string[] }
  /** Competitive: seats from first place down; ties share a place. */
  | { kind: 'competitive'; ranking: SeatId[][]; scores?: Record<SeatId, number> };

export interface GameMeta {
  /** Every seat, in table order. */
  seats: readonly SeatId[];
  minPlayers: number;
  maxPlayers: number;
  mode: 'coop' | 'competitive';
}

export interface SetupContext<C> {
  config: C;
  /** The seats taken, in table order. */
  seats: readonly SeatId[];
  /** The seed of the game's RNG: same seed and same moves, same game. */
  seed: number;
}

/**
 * A board game the platform can host. S = state, M = move, V = what one viewer sees,
 * C = the setup chosen before the game (scenario, options). Every function is pure: the
 * same arguments give the same result, and randomness comes only from the RNG kept in S.
 */
export interface GameDefinition<S, M, V, C> {
  /** Stable id: 'sky-team'. */
  id: string;
  /** Rules version, raised when saved states of the old version can no longer be read as is. */
  version: number;
  meta: GameMeta;

  /** Checks the setup a player asks for (scenario, options). */
  configSchema: ZodType<C>;
  /** Checks the shape of every move a client may send. */
  moveSchema: ZodType<M>;

  setup(ctx: SetupContext<C>): S;
  /** Who may act now (the platform shows whose turn it is; `validate` still decides). */
  actors(state: S): Actor[];
  /** Whether `by` may make `move` now. */
  validate(state: S, move: M, by: Mover): Result;
  /** The state after a valid move. Throws on an invalid one. */
  apply(state: S, move: M, by: Mover): S;
  /** The only way state leaves the server: what `viewer` may see at `now` (ms since epoch). */
  view(state: S, viewer: Viewer, now: number): V;
  /** Moves the platform must make later (Platform 02 uses this). */
  schedule?(state: S): ScheduledMove<M>[];
  /** How the game ended, or `null` while it goes on. */
  outcome(state: S): Outcome | null;
  /** Upgrades a state saved by an older rules version. */
  migrate?(state: unknown, fromVersion: number): S;
}
