// Pandemic behind the engine contract: the platform sees only this definition. It wraps the
// rule functions as they are; the server calls nothing else to change a game.
import type {
  Actor,
  GameDefinition,
  MoveContext,
  Outcome,
  Result,
  TableMove,
  Viewer,
} from '@platform/engine';
import { z } from 'zod';
import { CITIES, COLORS } from './cities';
import { FORECAST_CARDS } from './events';
import { applyMove, checkMove, type PandemicMove } from './moves';
import { applyPreflight, checkPreflight, isPreflightMove } from './preflight';
import { outcome } from './outcome';
import { shareAnswerer } from './share';
import { checkJoin, openTable, seatJoined, seatLeft } from './table';
import {
  EPIDEMIC_COUNTS,
  ROLE_IDS,
  ROLE_MODES,
  EVENT_IDS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  SEATS,
  type PandemicState,
  type SeatId,
} from './types';
import { tableViewFor, type TableView } from './views';

const cityId = z.enum(CITIES.map((city) => city.id) as [string, ...string[]]);
const color = z.enum(COLORS as unknown as [string, ...string[]]);
const seat = z.enum(SEATS as unknown as [string, ...string[]]);
const handCard = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('city'), city: cityId }),
  z.object({ kind: z.literal('event'), event: z.enum(EVENT_IDS) }),
]);

/** Playing an event card: the player's choices for each card (see `events/types.ts`). */
const playEvent = (event: string, choices: z.ZodRawShape = {}) =>
  z.object({ type: z.literal('play-event'), event: z.literal(event), ...choices });
const playEventSchema = z.discriminatedUnion('event', [
  playEvent('airlift', { pawn: seat, to: cityId }),
  playEvent('forecast'),
  playEvent('government-grant', { city: cityId, move: cityId.optional() }),
  playEvent('one-quiet-night'),
  playEvent('resilient-population', { city: cityId }),
]);

/** Every move a player may send. */
export const pandemicMoveSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('drive'), to: cityId, pawn: seat.optional() }),
  z.object({ type: z.literal('direct'), to: cityId, pawn: seat.optional() }),
  z.object({ type: z.literal('charter'), to: cityId, pawn: seat.optional() }),
  z.object({ type: z.literal('shuttle'), to: cityId, pawn: seat.optional() }),
  z.object({ type: z.literal('join'), to: cityId, pawn: seat.optional() }),
  z.object({ type: z.literal('build'), move: cityId.optional() }),
  z.object({ type: z.literal('treat'), color }),
  z.object({ type: z.literal('cure'), color, cards: z.array(cityId).max(5) }),
  z.object({ type: z.literal('pass') }),
  z.object({ type: z.literal('ops-flight'), to: cityId, card: cityId }),
  z.object({ type: z.literal('take-event'), event: z.enum(EVENT_IDS) }),
  z.object({
    type: z.literal('share-offer'),
    direction: z.enum(['give', 'take']),
    with: seat,
    city: cityId.optional(),
  }),
  z.object({ type: z.literal('share-accept') }),
  z.object({ type: z.literal('share-decline') }),
  z.object({ type: z.literal('share-cancel') }),
  z.object({ type: z.literal('move-accept') }),
  z.object({ type: z.literal('move-decline') }),
  z.object({ type: z.literal('move-cancel') }),
  z.object({ type: z.literal('draw') }),
  z.object({ type: z.literal('epidemic') }),
  z.object({ type: z.literal('infect') }),
  z.object({ type: z.literal('discard'), card: handCard }),
  playEventSchema,
  z.object({ type: z.literal('forecast-order'), cards: z.array(cityId).max(FORECAST_CARDS) }),
  z.object({ type: z.literal('pick-role'), role: z.enum(ROLE_IDS) }),
  z.object({ type: z.literal('confirm') }),
]) as unknown as z.ZodType<PandemicMove>;

/** Epidemic cards by difficulty: introductory, standard, heroic. */
const epidemics = z
  .number()
  .int()
  .refine((n) => EPIDEMIC_COUNTS.includes(n), 'bad-epidemics');

export const pandemicConfigSchema = z.object({
  /** Players at the table (2 to 4); the seats actually taken decide who plays. */
  players: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS).default(MIN_PLAYERS),
  /** Epidemic cards: 4 introductory, 5 standard, 6 heroic. */
  epidemics: epidemics.default(EPIDEMIC_COUNTS[0] as number),
  /** Roles dealt at random, or chosen by the players before the game. */
  roleMode: z.enum(ROLE_MODES).default('random'),
});
export type PandemicConfig = z.infer<typeof pandemicConfigSchema>;

/** What a player may choose in the lobby: players, difficulty and how roles are given out. */
export const pandemicLobbySchema = z
  .object({
    players: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS),
    epidemics,
    roleMode: z.enum(ROLE_MODES),
  })
  .partial();

export type PandemicLobby = z.infer<typeof pandemicLobbySchema>;
export type { PandemicMove };

type AnyMove = PandemicMove | TableMove;

const fail = (reason: string): Result => ({ ok: false, reason });
const isSeat = (value: string): value is SeatId => SEATS.includes(value as SeatId);

function check(state: PandemicState, move: AnyMove, { by }: MoveContext): Result {
  if (move.type === 'table:join') {
    return by === 'system' && isSeat(move.seat) ? checkJoin(state, move.seat) : fail('not-allowed');
  }
  if (move.type === 'table:leave') return by === 'system' ? { ok: true } : fail('not-allowed');
  // The turn order is random, so nobody chooses a seat.
  if (move.type === 'table:choose-seat') return fail('not-allowed');
  if (by === 'system') return fail('not-allowed');
  if (state.status === 'waiting') return fail('not-started');
  if (!isSeat(by) || !state.seats.includes(by)) return fail('not-seated');
  if (state.status === 'setup') {
    return isPreflightMove(move) ? checkPreflight(state, by, move) : fail('not-started');
  }
  return checkMove(state, by, move);
}

/**
 * Who must act now. Event cards are left out: any seat may play one at almost any moment, and
 * nobody has to, so `validate` allows them (`checkPlayEvent`) without an actor.
 */
function actors(state: PandemicState): Actor[] {
  // Before the game, everyone confirms (in any order); a confirmed seat is done.
  if (state.status === 'setup') {
    return state.seats.map((seat) => ({
      seat,
      kind: 'simultaneous',
      committed: state.confirmed.includes(seat),
    }));
  }
  if (state.status !== 'playing') return [];
  const { pending } = state;
  if (pending?.kind === 'discard') {
    return [{ seat: pending.seat, kind: 'prompt', prompt: 'discard' }];
  }
  if (pending?.kind === 'move') {
    return [{ seat: pending.pawn, kind: 'prompt', prompt: 'move' }];
  }
  if (pending?.kind === 'forecast') {
    return [{ seat: pending.seat, kind: 'prompt', prompt: 'forecast' }];
  }
  if (pending?.kind === 'share') {
    return [{ seat: shareAnswerer(state) as SeatId, kind: 'prompt', prompt: 'share' }];
  }
  return [{ seat: state.turn.seat, kind: 'turn' }];
}

export const pandemic: GameDefinition<PandemicState, AnyMove, TableView, PandemicConfig> = {
  id: 'pandemic',
  // 3: the state holds the `roles` (Pandemic 04). 4: the turn counts `epidemicsResolved` and the
  // state has `quietNight` (event cards, Pandemic 05). 5: the "before the game" step (`setup`
  // status) and the role mode (Pandemic 06). Older matches are not migrated (Pandemic was never
  // deployed), so they are dropped on load.
  version: 5,
  // A player who leaves frees the seat, not the hand: the game waits for whoever joins next.
  meta: {
    seats: SEATS,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    mode: 'coop',
    leave: 'hold',
  },
  configSchema: pandemicConfigSchema,
  moveSchema: pandemicMoveSchema,

  // The game waits until the number of players chosen in the lobby is seated, then goes through
  // the "before the game" step. A new game after one was played: whoever is still seated (2 or
  // more) plays it, with the same number of epidemics and role mode. The step starts afresh from
  // the new seed: a new turn order, and the roles dealt again (random) or picked again (choose).
  setup({ config, seats, seed, previous }) {
    const { epidemics, roleMode } = config;
    const again = previous !== undefined && previous.status !== 'waiting';
    const players = again && seats.length >= MIN_PLAYERS ? seats.length : config.players;
    return openTable({ seats: seats as SeatId[], players, epidemics, roleMode, seed });
  },
  actors,
  validate: check,
  apply(state, move, ctx) {
    const result = check(state, move, ctx);
    if (!result.ok) throw new Error(result.reason);
    if (move.type === 'table:join') return seatJoined(state, move.seat as SeatId);
    if (move.type === 'table:leave') return seatLeft(state, move.seat as SeatId);
    if (state.status === 'waiting') throw new Error('not-started');
    if (state.status === 'setup') {
      if (!isPreflightMove(move)) throw new Error('not-started');
      return applyPreflight(state, ctx.by as SeatId, move);
    }
    return applyMove(state, ctx.by as SeatId, move as PandemicMove);
  },
  view: (state, viewer: Viewer) => tableViewFor(state, viewer),
  // The "before the game" step is part of the match: the platform treats it as started.
  started: (state) => state.status !== 'waiting',
  outcome: (state): Outcome | null =>
    state.status === 'waiting' || state.status === 'setup' ? null : outcome(state),
};
