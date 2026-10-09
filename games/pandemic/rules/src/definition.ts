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
import { applyMove, checkMove, type PandemicMove } from './moves';
import { outcome } from './outcome';
import { shareAnswerer } from './share';
import { checkJoin, openTable, seatJoined, seatLeft } from './table';
import {
  EPIDEMIC_COUNTS,
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

/** Every move a player may send. */
export const pandemicMoveSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('drive'), to: cityId }),
  z.object({ type: z.literal('direct'), to: cityId }),
  z.object({ type: z.literal('charter'), to: cityId }),
  z.object({ type: z.literal('shuttle'), to: cityId }),
  z.object({ type: z.literal('build'), move: cityId.optional() }),
  z.object({ type: z.literal('treat'), color }),
  z.object({ type: z.literal('cure'), color, cards: z.array(cityId).max(5) }),
  z.object({ type: z.literal('pass') }),
  z.object({
    type: z.literal('share-offer'),
    direction: z.enum(['give', 'take']),
    with: seat,
  }),
  z.object({ type: z.literal('share-accept') }),
  z.object({ type: z.literal('share-decline') }),
  z.object({ type: z.literal('share-cancel') }),
  z.object({ type: z.literal('draw') }),
  z.object({ type: z.literal('epidemic') }),
  z.object({ type: z.literal('infect') }),
  z.object({ type: z.literal('discard'), card: handCard }),
]) as unknown as z.ZodType<PandemicMove>;

export const pandemicConfigSchema = z.object({
  /** Players at the table (2 to 4); the seats actually taken decide who plays. */
  players: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS).default(MIN_PLAYERS),
  /** Epidemic cards: 4 introductory, 5 standard, 6 heroic. */
  epidemics: z
    .number()
    .int()
    .refine((n) => EPIDEMIC_COUNTS.includes(n), 'bad-epidemics')
    .default(EPIDEMIC_COUNTS[0] as number),
});
export type PandemicConfig = z.infer<typeof pandemicConfigSchema>;

/** What a player may choose in the lobby: the number of players (difficulty comes in Pandemic 06). */
export const pandemicLobbySchema = z
  .object({ players: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS) })
  .partial();

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
  return checkMove(state, by, move);
}

function actors(state: PandemicState): Actor[] {
  if (state.status !== 'playing') return [];
  const { pending } = state;
  if (pending?.kind === 'discard') {
    return [{ seat: pending.seat, kind: 'prompt', prompt: 'discard' }];
  }
  if (pending?.kind === 'share') {
    return [{ seat: shareAnswerer(state) as SeatId, kind: 'prompt', prompt: 'share' }];
  }
  return [{ seat: state.turn.seat, kind: 'turn' }];
}

export const pandemic: GameDefinition<PandemicState, AnyMove, TableView, PandemicConfig> = {
  id: 'pandemic',
  version: 1,
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

  // The game waits until the number of players chosen in the lobby is seated.
  // A new game after one was played: whoever is still seated (2 or more) plays it, with the
  // same number of epidemics.
  setup({ config, seats, seed, previous }) {
    const { epidemics } = config;
    const again = previous !== undefined && previous.status !== 'waiting';
    const players = again && seats.length >= MIN_PLAYERS ? seats.length : config.players;
    return openTable({ seats: seats as SeatId[], players, epidemics, seed });
  },
  actors,
  validate: check,
  apply(state, move, ctx) {
    const result = check(state, move, ctx);
    if (!result.ok) throw new Error(result.reason);
    if (move.type === 'table:join') return seatJoined(state, move.seat as SeatId);
    if (move.type === 'table:leave') return seatLeft(state, move.seat as SeatId);
    if (state.status === 'waiting') throw new Error('not-started');
    return applyMove(state, ctx.by as SeatId, move as PandemicMove);
  },
  view: (state, viewer: Viewer) => tableViewFor(state, viewer),
  started: (state) => state.status !== 'waiting',
  outcome: (state): Outcome | null => (state.status === 'waiting' ? null : outcome(state)),
};
