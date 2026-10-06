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

/**
 * Who makes a move, and when (ms since epoch). The platform stamps the time, so rules that
 * need a clock (timers, delays) stay pure and a replay gives the same game.
 */
export interface MoveContext {
  by: Mover;
  at: number;
}

/**
 * What the platform tells a game about its table, as `'system'` moves (so a replay sees them
 * too). A game that does not care returns `ok` from `validate` and the same state from `apply`.
 */
export type TableMove =
  /** Someone took the free seat `seat`. */
  | { type: 'table:join'; seat: SeatId }
  /**
   * The host moves to `seat`; whoever sat there takes the host's old seat. The game says
   * whether that is still allowed (usually only before the game starts); the platform then
   * moves the players.
   */
  | { type: 'table:choose-seat'; seat: SeatId };

export const isTableMove = (move: unknown): move is TableMove => {
  const type = (move as { type?: unknown } | null)?.type;
  return typeof type === 'string' && type.startsWith('table:');
};

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

export interface SetupContext<C, S = unknown> {
  config: C;
  /** The seats taken, in table order. */
  seats: readonly SeatId[];
  /** The seat of the player who runs the setup (the room's creator). */
  host: SeatId;
  /** The seed of the game's RNG: same seed and same moves, same game. */
  seed: number;
  /**
   * The previous game at this table (a rematch, or a restart after someone left), so choices
   * made for it can carry over; absent for a new table.
   */
  previous?: S;
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
  /** Checks the shape of every move a client may send (not the platform's own `'system'` moves). */
  moveSchema: ZodType<M>;

  setup(ctx: SetupContext<C, S>): S;
  /** Who may act now (the platform shows whose turn it is; `validate` still decides). */
  actors(state: S): Actor[];
  /** Whether `ctx.by` may make `move` at `ctx.at`. */
  validate(state: S, move: M | TableMove, ctx: MoveContext): Result;
  /** The state after a valid move. Throws on an invalid one. */
  apply(state: S, move: M | TableMove, ctx: MoveContext): S;
  /** The only way state leaves the server: what `viewer` may see at `now` (ms since epoch). */
  view(state: S, viewer: Viewer, now: number): V;
  /**
   * Moves the platform must make later, as `'system'`: it arms a timer for the earliest, and
   * makes every move that is due before the next player move (and when a saved game loads).
   */
  schedule?(state: S): ScheduledMove<M>[];
  /** How the game ended, or `null` while it goes on. */
  outcome(state: S): Outcome | null;
  /** Upgrades a state saved by an older rules version. */
  migrate?(state: unknown, fromVersion: number): S;
}

/** A move as the platform made it: what, by whom, when. The match log is a list of these. */
export interface PlayedMove<M> {
  move: M | TableMove;
  by: Mover;
  at: number;
}

/**
 * Makes every scheduled move that is due at `now`, earliest first, each at its own time (a
 * round that ran out at 12:00 ends at 12:00, even if the server only notices later). Stops at
 * the first one `validate` refuses. Returns the moves made, in order.
 */
export function runDue<S, M, V, C>(
  definition: GameDefinition<S, M, V, C>,
  state: S,
  now: number,
  limit = 100,
): { state: S; moves: PlayedMove<M>[] } {
  const moves: PlayedMove<M>[] = [];
  for (let i = 0; i < limit; i++) {
    const due = (definition.schedule?.(state) ?? [])
      .filter((entry) => entry.at <= now)
      .sort((a, b) => a.at - b.at)[0];
    if (!due) break;
    const ctx: MoveContext = { by: 'system', at: due.at };
    if (!definition.validate(state, due.move, ctx).ok) break;
    state = definition.apply(state, due.move, ctx);
    moves.push({ move: due.move, ...ctx });
  }
  return { state, moves };
}

/** When the next scheduled move is due, or `null` when nothing is scheduled. */
export function nextDue<S>(definition: { schedule?(state: S): { at: number }[] }, state: S) {
  const times = (definition.schedule?.(state) ?? []).map((entry) => entry.at);
  return times.length > 0 ? Math.min(...times) : null;
}
