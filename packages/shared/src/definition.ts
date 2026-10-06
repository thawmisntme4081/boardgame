// Sky Team behind the engine contract: the platform sees only this definition. It wraps the
// rule functions as they are; the server calls nothing else to change a game.
import type {
  Actor,
  GameDefinition,
  MoveContext,
  Outcome,
  Result,
  ScheduledMove,
  TableMove,
  Viewer,
} from '@platform/engine';
import { z } from 'zod';
import { ABILITY_IDS, canCancelSwap, canUseAbility, cancelSwap, useAbility } from './abilities';
import {
  canBeReady,
  canChooseSeat,
  canConfirm,
  canPickAbility,
  chooseSeat,
  confirm,
  freshCrew,
  pickAbility,
  pickedAbilities,
  ready,
  seatJoined,
} from './crew';
import {
  DICE_PER_SEAT,
  MAX_COFFEE,
  NEXT_TURN_MS,
  armAutoRoll,
  canAutoRoll,
  canPlaceDie,
  canRerollDice,
  canSpendReroll,
  expireRoundTimer,
  otherSeat,
  placeDie,
  rerollDice,
  rollDice,
  roundTimeLeft,
  spendReroll,
  startRoundTimer,
} from './rules';
import { SCENARIOS, YUL } from './scenarios';
import { SLOT_IDS } from './slots';
import { createGame } from './state';
import { SEATS, type GameState, type Seat } from './types';
import { viewFor, type PlayerView } from './views';

const dieId = z.string().min(1).max(20);
const slot = z.enum(SLOT_IDS);

/** Every move a player may send. */
export const skyTeamMoveSchema = z.discriminatedUnion('type', [
  // Before round 1.
  z.object({ type: z.literal('pick-ability'), ability: z.enum(ABILITY_IDS).nullable() }),
  z.object({ type: z.literal('confirm') }),
  // The strategy phase.
  z.object({ type: z.literal('ready') }),
  // Placing.
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
]);
export type SkyTeamPlayerMove = z.infer<typeof skyTeamMoveSchema>;

/** Moves only the platform makes, when `schedule` says so. */
export type SkyTeamSystemMove =
  /** Total Trust: the dice roll by themselves after the pause. */
  | { type: 'roll' }
  /** A timed round ran out. */
  | { type: 'time-up' };

export type SkyTeamMove = SkyTeamPlayerMove | SkyTeamSystemMove;
type AnyMove = SkyTeamMove | TableMove;

export const skyTeamConfigSchema = z.object({
  scenario: z
    .string()
    .refine((id) => Object.hasOwn(SCENARIOS, id), 'unknown-scenario')
    .default(YUL.id),
  /** Round timer in ms, or `null` for an untimed game. */
  timerMs: z.number().int().positive().nullable().default(null),
  /** Total Trust: the pause before the automatic roll (tests and dev shorten it). */
  autoRollDelayMs: z.number().int().positive().default(NEXT_TURN_MS),
});
export type SkyTeamConfig = z.infer<typeof skyTeamConfigSchema>;

const OK: Result = { ok: true };
const fail = (reason: string): Result => ({ ok: false, reason });
const isSeat = (value: string): value is Seat => SEATS.includes(value as Seat);

const SYSTEM_MOVES: ReadonlySet<AnyMove['type']> = new Set([
  'roll',
  'time-up',
  'table:join',
  'table:choose-seat',
]);

function check(state: GameState, move: AnyMove, { by, at }: MoveContext): Result {
  if (SYSTEM_MOVES.has(move.type) !== (by === 'system')) return fail('not-allowed');
  if (by !== 'system' && !isSeat(by)) return fail('not-seated');
  const seat = by as Seat;
  switch (move.type) {
    case 'table:join':
      return isSeat(move.seat) ? OK : fail('unknown-seat');
    case 'table:choose-seat':
      return isSeat(move.seat) ? canChooseSeat(state) : fail('unknown-seat');
    case 'roll':
      return canAutoRoll(state, at);
    case 'time-up':
      return roundTimeLeft(state, at) === 0 ? OK : fail('time-left');
    case 'pick-ability':
      return canPickAbility(state, seat, move.ability);
    case 'confirm':
      return canConfirm(state);
    case 'ready':
      return canBeReady(state);
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
  }
}

function play(state: GameState, move: AnyMove, { by, at }: MoveContext): GameState {
  const seat = by as Seat;
  switch (move.type) {
    case 'table:join':
      return seatJoined(state, move.seat as Seat);
    case 'table:choose-seat':
      return chooseSeat(state, move.seat as Seat);
    case 'roll':
      // Timed games: the round's countdown starts with the roll.
      return startRoundTimer(rollDice(state), at);
    case 'time-up':
      return expireRoundTimer(state, at);
    case 'pick-ability':
      return pickAbility(state, seat, move.ability);
    case 'confirm':
      return confirm(state, seat);
    case 'ready':
      return ready(state, seat, at);
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
  }
}

function actors(state: GameState): Actor[] {
  const { crew } = state;
  switch (state.phase) {
    case 'setup':
      return SEATS.filter((seat) => crew.seated[seat]).map((seat) => ({
        seat,
        kind: 'simultaneous',
        committed: crew.confirmed[seat],
      }));
    case 'strategy':
      // Total Trust: nobody talks or presses "Roll dice"; the dice roll by themselves.
      if (state.autoRoll) return [];
      return SEATS.map((seat) => ({ seat, kind: 'simultaneous', committed: crew.ready[seat] }));
    case 'placing': {
      // A spent reroll token: both seats choose their dice at once.
      const rerolling = SEATS.filter((seat) => state.rerollPending[seat]);
      if (rerolling.length > 0) {
        return rerolling.map((seat) => ({ seat, kind: 'simultaneous', committed: false }));
      }
      // Working Together: the partner answers with one of their dice.
      if (state.swap) {
        return [{ seat: otherSeat(state.swap.seat), kind: 'prompt', prompt: 'swap' }];
      }
      return state.currentSeat ? [{ seat: state.currentSeat, kind: 'turn' }] : [];
    }
    default:
      return [];
  }
}

function schedule(state: GameState): ScheduledMove<SkyTeamMove>[] {
  if (state.phase === 'placing' && state.deadline !== null) {
    return [{ at: state.deadline, move: { type: 'time-up' } }];
  }
  if (state.phase === 'strategy' && state.autoRollAt !== null) {
    return [{ at: state.autoRollAt, move: { type: 'roll' } }];
  }
  return [];
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

  // Games wait in `setup` for the crew's seats, abilities and confirms.
  setup({ config, seats, host, seed, previous }) {
    const seated = { pilot: seats.includes('pilot'), copilot: seats.includes('copilot') };
    const crew = freshCrew(isSeat(host) ? host : 'pilot', seated);
    if (previous) {
      // A rematch or a restart: the picks of those still seated are the starting point, and
      // the roles stay chosen while the same crew plays on.
      for (const seat of SEATS) if (seated[seat]) crew.picks[seat] = previous.crew.picks[seat];
      crew.rolesChosen =
        previous.crew.rolesChosen &&
        SEATS.every((seat) => previous.crew.seated[seat] === seated[seat]);
    }
    const state = createGame(SCENARIOS[config.scenario]!, seed, {
      setup: true,
      timerMs: config.timerMs,
      autoRollDelayMs: config.autoRollDelayMs,
      crew,
    });
    return { ...state, abilities: pickedAbilities(state) };
  },
  actors,
  validate: check,
  apply(state, move, ctx) {
    const result = check(state, move, ctx);
    if (!result.ok) throw new Error(result.reason);
    // Total Trust's roll is timed from the move that began the strategy phase.
    return armAutoRoll(play(state, move, ctx), ctx.at);
  },
  view(state, viewer: Viewer, now) {
    // Spectators come with the platform's rooms; until then only the two seats have a view.
    if (!isSeat(viewer)) throw new Error(`no view for ${viewer}`);
    return viewFor(state, viewer, now);
  },
  schedule,
  outcome,
};
