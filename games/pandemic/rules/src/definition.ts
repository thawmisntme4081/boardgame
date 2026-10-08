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
import { createGame } from './setup';
import {
  EPIDEMIC_COUNTS,
  EVENT_IDS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  SEATS,
  type GameState,
  type SeatId,
} from './types';
import { viewFor, type PandemicView } from './views';

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

type AnyMove = PandemicMove | TableMove;

const OK: Result = { ok: true };
const fail = (reason: string): Result => ({ ok: false, reason });
const isSeat = (value: string): value is SeatId => SEATS.includes(value as SeatId);

function check(state: GameState, move: AnyMove, { by }: MoveContext): Result {
  if (move.type === 'table:join') return by === 'system' ? OK : fail('not-allowed');
  // The turn order is random, so nobody chooses a seat.
  if (move.type === 'table:choose-seat') return fail('not-allowed');
  if (by === 'system') return fail('not-allowed');
  if (!isSeat(by) || !state.seats.includes(by)) return fail('not-seated');
  return checkMove(state, by, move);
}

function actors(state: GameState): Actor[] {
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

export const pandemic: GameDefinition<GameState, AnyMove, PandemicView, PandemicConfig> = {
  id: 'pandemic',
  version: 1,
  meta: { seats: SEATS, minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS, mode: 'coop' },
  configSchema: pandemicConfigSchema,
  moveSchema: pandemicMoveSchema,

  setup({ config, seats, seed }) {
    return createGame({ seats: seats as SeatId[], epidemics: config.epidemics, seed });
  },
  actors,
  validate: check,
  apply(state, move, ctx) {
    const result = check(state, move, ctx);
    if (!result.ok) throw new Error(result.reason);
    if (move.type === 'table:join') return state;
    return applyMove(state, ctx.by as SeatId, move as PandemicMove);
  },
  view: (state, viewer: Viewer) => viewFor(state, viewer),
  outcome: (state): Outcome | null => outcome(state),
};
