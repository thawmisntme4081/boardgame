// Sky Team behind the engine contract: the platform sees only this definition. It wraps the
// rule functions as they are; the socket handlers still call those directly until Platform 02.
import type { Actor, GameDefinition, Mover, Outcome, Result, Viewer } from '@platform/engine';
import { z } from 'zod';
import { ABILITY_IDS, canCancelSwap, canUseAbility, cancelSwap, useAbility } from './abilities';
import {
  DICE_PER_SEAT,
  MAX_COFFEE,
  beginGame,
  canPlaceDie,
  canRerollDice,
  canSpendReroll,
  expireRoundTimer,
  isGameOver,
  otherSeat,
  placeDie,
  rerollDice,
  rollDice,
  roundTimeLeft,
  spendReroll,
  startRoundTimer,
} from './rules';
import { SCENARIOS } from './scenarios';
import { SLOT_IDS } from './slots';
import { createGame } from './state';
import { SEATS, type GameState, type Seat } from './types';
import { viewFor, type PlayerView } from './views';

const dieId = z.string().min(1).max(20);
const slot = z.enum(SLOT_IDS);
/** Moves carry their time (`at`, ms since epoch), so `apply` never reads the clock. */
const at = z.number().int().nonnegative();

export const skyTeamMoveSchema = z.discriminatedUnion('type', [
  // By a seat.
  z.object({
    type: z.literal('place'),
    dieId,
    slot,
    coffeeDelta: z.number().int().min(-MAX_COFFEE).max(MAX_COFFEE),
    tokenSlot: slot.optional(),
  }),
  z.object({ type: z.literal('spend-reroll') }),
  z.object({ type: z.literal('reroll'), dieIds: z.array(dieId).max(DICE_PER_SEAT) }),
  z.object({
    type: z.literal('ability'),
    ability: z.enum(['adaptation', 'anticipation', 'working-together']),
    dieId,
  }),
  z.object({ type: z.literal('cancel-swap') }),
  // By the system: round 1 starts, the dice roll (both ready, or Total Trust), time runs out.
  z.object({ type: z.literal('begin') }),
  z.object({ type: z.literal('roll'), at }),
  z.object({ type: z.literal('time-up'), at }),
]);
export type SkyTeamMove = z.infer<typeof skyTeamMoveSchema>;

const SYSTEM_MOVES: ReadonlySet<SkyTeamMove['type']> = new Set(['begin', 'roll', 'time-up']);

export const skyTeamConfigSchema = z.object({
  scenario: z.string().refine((id) => Object.hasOwn(SCENARIOS, id), 'unknown-scenario'),
  /** Round timer in ms, or `null` for an untimed game. */
  timerMs: z.number().int().positive().nullable().default(null),
  abilities: z.array(z.enum(ABILITY_IDS)).default([]),
});
export type SkyTeamConfig = z.infer<typeof skyTeamConfigSchema>;

const OK: Result = { ok: true };
const fail = (reason: string): Result => ({ ok: false, reason });

function check(state: GameState, move: SkyTeamMove, by: Mover): Result {
  if (SYSTEM_MOVES.has(move.type) !== (by === 'system')) return fail('not-allowed');
  if (by !== 'system' && !SEATS.includes(by as Seat)) return fail('not-seated');
  const seat = by as Seat;
  switch (move.type) {
    case 'place':
      return canPlaceDie(state, seat, move);
    case 'spend-reroll':
      return canSpendReroll(state);
    case 'reroll':
      return canRerollDice(state, seat, move.dieIds);
    case 'ability':
      return canUseAbility(state, seat, move);
    case 'cancel-swap':
      return canCancelSwap(state, seat);
    case 'begin':
      return state.phase === 'setup' ? OK : fail('not-setup');
    case 'roll':
      if (isGameOver(state)) return fail('game-over');
      return state.phase === 'strategy' ? OK : fail('not-strategy');
    case 'time-up':
      return roundTimeLeft(state, move.at) === 0 ? OK : fail('time-left');
  }
}

function play(state: GameState, move: SkyTeamMove, seat: Seat): GameState {
  switch (move.type) {
    case 'place':
      return placeDie(state, seat, {
        dieId: move.dieId,
        slot: move.slot,
        coffeeDelta: move.coffeeDelta,
        ...(move.tokenSlot && { tokenSlot: move.tokenSlot }),
      });
    case 'spend-reroll':
      return spendReroll(state, seat);
    case 'reroll':
      return rerollDice(state, seat, move.dieIds);
    case 'ability':
      return useAbility(state, seat, { ability: move.ability, dieId: move.dieId });
    case 'cancel-swap':
      return cancelSwap(state, seat);
    case 'begin':
      return beginGame(state);
    case 'roll':
      // Timed games: the round's countdown starts with the roll.
      return startRoundTimer(rollDice(state), move.at);
    case 'time-up':
      return expireRoundTimer(state, move.at);
  }
}

function actors(state: GameState): Actor[] {
  if (state.phase !== 'placing') return [];
  // A spent reroll token: both seats choose their dice at once.
  const rerolling = SEATS.filter((seat) => state.rerollPending[seat]);
  if (rerolling.length > 0) {
    return rerolling.map((seat) => ({ seat, kind: 'simultaneous', committed: false }));
  }
  // Working Together: the partner answers with one of their dice.
  if (state.swap) return [{ seat: otherSeat(state.swap.seat), kind: 'prompt', prompt: 'swap' }];
  return state.currentSeat ? [{ seat: state.currentSeat, kind: 'turn' }] : [];
}

function outcome(state: GameState): Outcome | null {
  if (state.phase === 'won') return { kind: 'coop', won: true, reasons: [] };
  if (state.phase !== 'lost') return null;
  const reasons = state.landingFailures ?? (state.endReason ? [state.endReason] : []);
  return { kind: 'coop', won: false, reasons };
}

export const skyTeam: GameDefinition<GameState, SkyTeamMove, PlayerView, SkyTeamConfig> = {
  id: 'sky-team',
  version: 1,
  meta: { seats: SEATS, minPlayers: 2, maxPlayers: 2, mode: 'coop' },
  configSchema: skyTeamConfigSchema,
  moveSchema: skyTeamMoveSchema,

  // Games wait in `setup` for the crew's seats and abilities, then a `begin` move.
  setup: ({ config, seed }) =>
    createGame(SCENARIOS[config.scenario]!, seed, {
      setup: true,
      timerMs: config.timerMs,
      abilities: config.abilities,
    }),
  actors,
  validate: check,
  apply(state, move, by) {
    const result = check(state, move, by);
    if (!result.ok) throw new Error(result.reason);
    return play(state, move, by as Seat);
  },
  view(state, viewer: Viewer, now) {
    // Spectators come with the platform's rooms; until then only the two seats have a view.
    if (!SEATS.includes(viewer as Seat)) throw new Error(`no view for ${viewer}`);
    return viewFor(state, viewer as Seat, now);
  },
  schedule: (state) =>
    state.phase === 'placing' && state.deadline !== null
      ? [{ at: state.deadline, move: { type: 'time-up', at: state.deadline } }]
      : [],
  outcome,
};
