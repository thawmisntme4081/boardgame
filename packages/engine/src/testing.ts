// The engine test kit: checks any game through its GameDefinition alone. Every game runs it
// in its own tests. Plain functions that throw on a problem (no test framework needed).
import { deepStrictEqual } from 'node:assert/strict';
import { nextRandom } from './rng';
import {
  isTableMove,
  type GameDefinition,
  type Outcome,
  type PlayedMove,
  type SeatId,
  type Viewer,
} from './index';

export type { PlayedMove } from './index';

/** A move the test wants to make; `at` defaults to the kit's clock. */
export type NextMove<M> = Omit<PlayedMove<M>, 'at'> & { at?: number };

export interface KitOptions<S, M, V, C> {
  definition: GameDefinition<S, M, V, C>;
  /** The setup as a player would ask for it (it goes through `configSchema`). */
  config: unknown;
  seats: readonly SeatId[];
  seed: number;
  /**
   * The next move to try: a legal one, from any seat or the system (scheduled moves and table
   * moves included). `random` is the kit's own stream, so the test's choices never disturb
   * the game's RNG; `now` is the kit's clock.
   */
  nextMove(state: S, random: () => number, now: number): NextMove<M>;
  /**
   * What `viewer` must not see: returns one message per leak (empty when nothing leaks).
   * The kit already checks that views are plain data.
   */
  findLeaks?(state: S, view: V, viewer: Viewer): string[];
  /** The kit's clock (ms since epoch): the time of every move that does not set its own. */
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
  const state = definition.setup({ config, seats, host: seats[0]!, seed });
  assertPlainData(state, 'setup');
  return state;
}

/** Every check a state must pass after each move. */
function checkState<S, M, V, C>(
  options: KitOptions<S, M, V, C>,
  state: S,
  step: number,
  now: number,
): void {
  const { definition, seats } = options;
  assertPlainData(state, `step ${step}: state`);
  for (const actor of definition.actors(state)) {
    if (!definition.meta.seats.includes(actor.seat)) {
      throw new Error(`step ${step}: actor ${actor.seat} is not a seat of ${definition.id}`);
    }
  }
  // A scheduled move must be valid when it falls due.
  for (const { at, move } of definition.schedule?.(state) ?? []) {
    const check = definition.validate(state, move, { by: 'system', at });
    if (!check.ok) {
      throw new Error(
        `step ${step}: scheduled ${JSON.stringify(move)} is refused: ${check.reason}`,
      );
    }
  }
  for (const viewer of seats) {
    const view = definition.view(state, viewer, now);
    assertPlainData(view, `step ${step}: view for ${viewer}`);
    const leaks = options.findLeaks?.(state, view, viewer) ?? [];
    if (leaks.length > 0) {
      throw new Error(`step ${step}: view for ${viewer} leaks: ${leaks.join('; ')}`);
    }
  }
}

/**
 * Plays one game with `nextMove`, through the definition only: every player move must pass
 * the move schema and `validate`, and every state and view is checked. Returns the moves.
 */
export function playRandomGame<S, M, V, C>(options: KitOptions<S, M, V, C>): PlayedGame<S, M> {
  const { definition, maxSteps = 2000 } = options;
  const random = kitRandom(options.seed);
  const clock = options.now ?? 0;
  let state = setup(options);
  checkState(options, state, 0, clock);
  const moves: PlayedMove<M>[] = [];
  for (let step = 1; step <= maxSteps; step++) {
    const outcome = definition.outcome(state);
    if (outcome) return { final: state, moves, outcome };
    const next = options.nextMove(state, random, clock);
    const played: PlayedMove<M> = { move: next.move, by: next.by, at: next.at ?? clock };
    const label = `step ${step}: ${played.by} ${JSON.stringify(played.move)}`;
    // `moveSchema` covers what clients send; the platform's own moves never come from one.
    const fromClient = played.by !== 'system';
    if (fromClient && isTableMove(played.move)) throw new Error(`${label}: only the system`);
    if (fromClient && !definition.moveSchema.safeParse(played.move).success) {
      throw new Error(`${label} fails the move schema`);
    }
    const check = definition.validate(state, played.move, played);
    if (!check.ok) throw new Error(`${label}: ${check.reason}`);
    state = definition.apply(state, played.move, played);
    moves.push(played);
    checkState(options, state, step, played.at);
  }
  throw new Error(`${definition.id} seed ${options.seed}: no outcome after ${maxSteps} moves`);
}

/** Replays the same moves from the same seed: the game must end in the very same state. */
export function checkReplay<S, M, V, C>(
  options: KitOptions<S, M, V, C>,
  played: PlayedGame<S, M>,
): void {
  let state = setup(options);
  for (const move of played.moves) state = options.definition.apply(state, move.move, move);
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
