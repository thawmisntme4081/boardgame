// The engine test kit: checks any game through its GameDefinition alone. Every game runs it
// in its own tests. Plain functions that throw on a problem (no test framework needed).
import { deepStrictEqual } from 'node:assert/strict';
import { nextRandom } from './rng';
import type { GameDefinition, Mover, Outcome, SeatId, Viewer } from './index';

export interface PlayedMove<M> {
  move: M;
  by: Mover;
}

export interface KitOptions<S, M, V, C> {
  definition: GameDefinition<S, M, V, C>;
  /** The setup as a player would ask for it (it goes through `configSchema`). */
  config: unknown;
  seats: readonly SeatId[];
  seed: number;
  /**
   * The next move to try: a legal one, from any seat or the system. `random` is the kit's
   * own stream, so the test's choices never disturb the game's RNG.
   */
  nextMove(state: S, random: () => number): PlayedMove<M>;
  /**
   * What `viewer` must not see: returns one message per leak (empty when nothing leaks).
   * The kit already checks that views are plain data.
   */
  findLeaks?(state: S, view: V, viewer: Viewer): string[];
  /** The clock the views are checked at (ms since epoch). */
  now?: number;
  /** A game that runs longer than this fails the check. */
  maxSteps?: number;
}

export interface PlayedGame<S, M> {
  final: S;
  moves: PlayedMove<M>[];
  outcome: Outcome;
}

/**
 * Throws if `value` is not plain JSON data: a saved state or a view must survive
 * `JSON.stringify` unchanged (no Map, Set, Date, class, function, undefined in arrays,
 * NaN or Infinity).
 */
export function assertPlainData(value: unknown, path = '$'): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path}: ${value} is not JSON`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      if (item === undefined) throw new Error(`${path}[${i}]: undefined in an array`);
      assertPlainData(item, `${path}[${i}]`);
    });
    return;
  }
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value) as unknown;
    if (proto !== Object.prototype && proto !== null) {
      throw new Error(
        `${path}: ${(value as object).constructor?.name ?? 'object'} is not plain data`,
      );
    }
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) assertPlainData(item, `${path}.${key}`);
    }
    return;
  }
  throw new Error(`${path}: a ${typeof value} is not JSON`);
}

/** A random stream for the test's choices, apart from the game's RNG. */
function kitRandom(seed: number): () => number {
  let state = seed ^ 0x2545f491;
  return () => {
    const r = nextRandom(state);
    state = r.rngState;
    return r.value;
  };
}

function setup<S, M, V, C>(options: KitOptions<S, M, V, C>): S {
  const { definition, seats, seed } = options;
  const config = definition.configSchema.parse(options.config);
  const state = definition.setup({ config, seats, seed });
  assertPlainData(state, 'setup');
  return state;
}

/** Every check a state must pass after each move. */
function checkState<S, M, V, C>(options: KitOptions<S, M, V, C>, state: S, step: number): void {
  const { definition, seats } = options;
  assertPlainData(state, `step ${step}: state`);
  for (const actor of definition.actors(state)) {
    if (!definition.meta.seats.includes(actor.seat)) {
      throw new Error(`step ${step}: actor ${actor.seat} is not a seat of ${definition.id}`);
    }
  }
  for (const viewer of seats) {
    const view = definition.view(state, viewer, options.now ?? 0);
    assertPlainData(view, `step ${step}: view for ${viewer}`);
    const leaks = options.findLeaks?.(state, view, viewer) ?? [];
    if (leaks.length > 0)
      throw new Error(`step ${step}: view for ${viewer} leaks: ${leaks.join('; ')}`);
  }
}

/**
 * Plays one game with `nextMove`, through the definition only: every move must pass the move
 * schema and `validate`, and every state and view is checked. Returns the moves played.
 */
export function playRandomGame<S, M, V, C>(options: KitOptions<S, M, V, C>): PlayedGame<S, M> {
  const { definition, maxSteps = 2000 } = options;
  const random = kitRandom(options.seed);
  let state = setup(options);
  checkState(options, state, 0);
  const moves: PlayedMove<M>[] = [];
  for (let step = 1; step <= maxSteps; step++) {
    const outcome = definition.outcome(state);
    if (outcome) return { final: state, moves, outcome };
    const played = options.nextMove(state, random);
    const parsed = definition.moveSchema.safeParse(played.move);
    if (!parsed.success) {
      throw new Error(`step ${step}: ${JSON.stringify(played.move)} fails the move schema`);
    }
    const check = definition.validate(state, played.move, played.by);
    if (!check.ok) {
      throw new Error(`step ${step}: ${played.by} ${JSON.stringify(played.move)}: ${check.reason}`);
    }
    state = definition.apply(state, played.move, played.by);
    moves.push(played);
    checkState(options, state, step);
  }
  throw new Error(`${definition.id} seed ${options.seed}: no outcome after ${maxSteps} moves`);
}

/** Replays the same moves from the same seed: the game must end in the very same state. */
export function checkReplay<S, M, V, C>(
  options: KitOptions<S, M, V, C>,
  played: PlayedGame<S, M>,
): void {
  let state = setup(options);
  for (const { move, by } of played.moves) state = options.definition.apply(state, move, by);
  deepStrictEqual(
    state,
    played.final,
    `${options.definition.id} seed ${options.seed}: replay differs`,
  );
}

/** The whole kit for one seed: a random game, then its replay. */
export function checkGame<S, M, V, C>(options: KitOptions<S, M, V, C>): PlayedGame<S, M> {
  const played = playRandomGame(options);
  checkReplay(options, played);
  return played;
}
