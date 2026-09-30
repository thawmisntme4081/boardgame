import { MODULES, modulesOf, type Resolver } from './modules';
import { nextRandom, rollDie } from './rng';
import { activeSlots, MANDATORY_SLOTS, SLOTS, slotActive, type SlotGroup } from './slots';
import type {
  AltitudeSpace,
  Die,
  DieValue,
  EndReason,
  GameState,
  ModuleId,
  MoveCheck,
  MoveError,
  Phase,
  PlaceIntent,
  PlacedDie,
  Scenario,
  Seat,
  SlotId,
} from './types';

/** The Axis Arrow reaching this many marks from level is a spin. */
export const AXIS_LIMIT = 3;
export const MAX_COFFEE = 3;
export const DICE_PER_SEAT = 4;
/** Brake marker position by brakes deployed: left of 2, then past 2, 4 and 6. Speed must not exceed it. */
export const BRAKE_THRESHOLDS: readonly number[] = [1, 2, 4, 6];
/** Faces of the black Traffic die. */
export const TRAFFIC_DIE: readonly DieValue[] = [2, 3, 3, 4, 4, 5];
/** Airplane tokens in the box: the traffic die adds planes only while some are left. */
export const PLANE_TOKENS = 12;
/** Reroll tokens in the box (2 in the base game, 1 with the modules). */
export const REROLL_TOKENS = 3;

/** Thrown when a rule function is called with a move that `can*` would reject. */
export class RuleError extends Error {
  constructor(readonly reason: MoveError) {
    super(reason);
    this.name = 'RuleError';
  }
}

export const otherSeat = (seat: Seat): Seat => (seat === 'pilot' ? 'copilot' : 'pilot');

export function currentAltitude(state: Pick<GameState, 'scenario' | 'round'>): AltitudeSpace {
  const space = state.scenario.altitudes[state.round - 1];
  if (!space) throw new Error(`no altitude for round ${state.round}`);
  return space;
}

export const isFinalRound = (state: GameState): boolean =>
  state.round === state.scenario.altitudes.length;

export const airportIndex = (state: GameState): number => state.approachPlanes.length - 1;

export const isGameOver = (state: Pick<GameState, 'phase'>): boolean =>
  state.phase === 'won' || state.phase === 'lost';

/** How many spaces the Approach Track advances for a given speed: 0, 1 or 2. */
export function approachSteps(speed: number, aeroBlue: number, aeroOrange: number): 0 | 1 | 2 {
  if (speed <= aeroBlue) return 0;
  if (speed <= aeroOrange) return 1;
  return 2;
}

/** Where the brake marker sits (landing speed must not exceed it); Ice brakes have their own track. */
export function brakeThreshold(brakes: number, modules: readonly ModuleId[] = []): number {
  const thresholds =
    modules.map((id) => MODULES[id].brakeThresholds).find(Boolean) ?? BRAKE_THRESHOLDS;
  return thresholds[Math.min(brakes, thresholds.length - 1)]!;
}

const fail = (reason: MoveError): MoveCheck => ({ ok: false, reason });
const OK: MoveCheck = { ok: true };

/**
 * What a placement check reads. The server builds it from `GameState`; a client's
 * `PlayerView` already has this shape, so both sides run the exact same rule.
 */
export interface PlacementContext {
  seat: Seat;
  myDice: readonly Die[];
  placed: Partial<Record<SlotId, PlacedDie>>;
  coffee: number;
  flaps: readonly boolean[];
  brakes: number;
  scenario: Pick<Scenario, 'modules'>;
  intern: readonly DieValue[] | null;
  /** Synchronisation's traffic die, which the co-pilot must place before anything else. */
  bonus: { die: Die } | null;
  /** A Working Together swap waiting for the partner: nobody places until it is done. */
  swap: { seat: Seat } | null;
}

export const placementContext = (state: GameState, seat: Seat): PlacementContext => ({
  seat,
  myDice: state.dice[seat],
  placed: state.placed,
  coffee: state.coffee,
  flaps: state.flaps,
  brakes: state.brakes,
  scenario: state.scenario,
  intern: state.intern,
  bonus: state.bonus,
  swap: state.swap,
});

/**
 * Colour, number and order checks for anything going on `slot`: a die, an Intern token or
 * the traffic die (`seat` null: any colour).
 */
export function checkSlot(
  ctx: PlacementContext,
  seat: Seat | null,
  slot: SlotId,
  value: DieValue,
): MoveError | null {
  const def = SLOTS[slot];
  if (!def || !slotActive(ctx.scenario.modules, slot)) return 'unknown-slot';
  if (ctx.placed[slot]) return 'slot-taken';
  if (seat && !def.seats.includes(seat)) return 'wrong-seat';
  if (def.values && !def.values.includes(value)) return 'value-not-allowed';
  if (def.group === 'flaps' && !ctx.flaps.slice(0, def.index).every(Boolean)) {
    return 'out-of-order';
  }
  if (def.group === 'brakes' && ctx.brakes < def.index) return 'out-of-order';
  return (def.module && MODULES[def.module].checkSlot?.(ctx, slot, value)) || null;
}

/** The traffic die goes on any empty Control Panel space, not the side boards. */
const OFF_PANEL: readonly SlotGroup[] = ['kerosene', 'intern'];

/** Colour, number, order and coffee checks, ignoring phase and turn. */
export function checkPlacement(ctx: PlacementContext, intent: PlaceIntent): MoveCheck {
  if (ctx.swap) return fail('swap-pending');
  const { bonus } = ctx;
  if (bonus && intent.dieId !== bonus.die.id) return fail('bonus-pending');
  const die = bonus
    ? ctx.seat === 'copilot'
      ? bonus.die
      : undefined
    : ctx.myDice.find((d) => d.id === intent.dieId);
  if (!die) return fail('unknown-die');
  const def = SLOTS[intent.slot];
  if (!def || !slotActive(ctx.scenario.modules, intent.slot)) return fail('unknown-slot');
  if (ctx.placed[intent.slot]) return fail('slot-taken');
  // The co-pilot places the traffic die on any colour.
  const seat = bonus ? null : ctx.seat;
  if (seat && !def.seats.includes(seat)) return fail('wrong-seat');
  if (bonus && OFF_PANEL.includes(def.group)) return fail('slot-not-allowed');

  const { coffeeDelta } = intent;
  if (!Number.isInteger(coffeeDelta) || (bonus && coffeeDelta !== 0)) return fail('bad-coffee');
  if (Math.abs(coffeeDelta) > ctx.coffee) return fail('not-enough-coffee');
  const value = die.value + coffeeDelta;
  if (value < 1 || value > 6) return fail('value-out-of-range');

  const slotError = checkSlot(ctx, seat, intent.slot, value as DieValue);
  if (slotError) return fail(slotError);
  const checkMove = def.module && MODULES[def.module].checkMove;
  if (checkMove) {
    const moveError = checkMove(ctx, intent, value as DieValue, checkSlot);
    if (moveError) return fail(moveError);
  } else if (intent.tokenSlot !== undefined) {
    return fail('bad-token-slot');
  }
  return OK;
}

/** Phase and turn checks shared by `canPlaceDie` and the client's `canPlaceInView`. */
export function checkTurn(phase: Phase, currentSeat: Seat | null, seat: Seat): MoveCheck {
  if (phase === 'won' || phase === 'lost') return fail('game-over');
  if (phase !== 'placing') return fail('not-placing');
  if (currentSeat !== seat) return fail('not-your-turn');
  return OK;
}

export function canPlaceDie(state: GameState, seat: Seat, intent: PlaceIntent): MoveCheck {
  const turn = checkTurn(state.phase, state.currentSeat, seat);
  return turn.ok ? checkPlacement(placementContext(state, seat), intent) : turn;
}

/** Coffee modifiers a die can take: at most one token each way per coffee, staying in 1..6. */
export function coffeeRange(coffee: number, value: DieValue): { min: number; max: number } {
  // `0 - x` rather than `-x`: never a -0 delta, which JSON would turn into 0.
  return { min: Math.max(0 - coffee, 1 - value), max: Math.min(coffee, 6 - value) };
}

/** Every legal placement in `ctx`, lazily (Intern moves also pick where the token goes). */
function* candidateMoves(ctx: PlacementContext): Generator<PlaceIntent> {
  const dice = ctx.bonus ? (ctx.seat === 'copilot' ? [ctx.bonus.die] : []) : ctx.myDice;
  const slots = activeSlots(ctx.scenario.modules);
  for (const die of dice) {
    const { min, max } = ctx.bonus ? { min: 0, max: 0 } : coffeeRange(ctx.coffee, die.value);
    for (const slot of slots) {
      const tokenSlots = SLOTS[slot].group === 'intern' ? slots : [undefined];
      for (let coffeeDelta = min; coffeeDelta <= max; coffeeDelta++) {
        for (const tokenSlot of tokenSlots) {
          const intent: PlaceIntent = { dieId: die.id, slot, coffeeDelta };
          if (tokenSlot) intent.tokenSlot = tokenSlot;
          if (checkPlacement(ctx, intent).ok) yield intent;
        }
      }
    }
  }
}

/** Every legal placement for `seat`'s dice, ignoring whose turn it is. */
export function legalMoves(state: GameState, seat: Seat): PlaceIntent[] {
  if (state.phase !== 'placing') return [];
  return [...candidateMoves(placementContext(state, seat))];
}

/** Whether `seat` could place something; a pending swap only pauses play, so it is ignored. */
function hasLegalMove(state: GameState, seat: Seat): boolean {
  return !candidateMoves({ ...placementContext(state, seat), swap: null }).next().done;
}

function rollFor(state: GameState, ids: string[]): Die[] {
  return ids.map((id) => {
    const r = rollDie(state.rngState);
    state.rngState = r.rngState;
    return { id, value: r.value };
  });
}

function rollTrafficDie(state: GameState): DieValue {
  const r = nextRandom(state.rngState);
  state.rngState = r.rngState;
  return TRAFFIC_DIE[Math.floor(r.value * TRAFFIC_DIE.length)]!;
}

const endGame = (state: GameState, result: 'won' | 'lost', reason?: EndReason): void => {
  state.phase = result;
  state.currentSeat = null;
  state.deadline = null;
  state.bonus = null;
  state.swap = null;
  if (reason) state.endReason = reason;
  state.log.push({ type: 'game-end', round: state.round, result, ...(reason && { reason }) });
};

/**
 * Traffic die, at the start of a round: one roll per Traffic icon on the current space;
 * each roll adds a plane that many spaces ahead, counting the current one (past the end:
 * the airport), while the box has planes left. Called by `createGame` and between rounds.
 */
export function rollTraffic(state: GameState): void {
  const icons = state.scenario.traffic?.[state.approachIndex] ?? 0;
  if (icons === 0) return;
  const rolls: number[] = [];
  for (let i = 0; i < icons; i++) {
    const roll = rollTrafficDie(state);
    rolls.push(roll);
    if (state.planeSupply > 0) {
      state.approachPlanes[Math.min(state.approachIndex + roll - 1, airportIndex(state))]!++;
      state.planeSupply--;
    }
  }
  state.log.push({ type: 'traffic', round: state.round, rolls });
}

/**
 * Timed games: starts the round's countdown at `now` (call right after `rollDice`).
 * Untimed games, and states that are not placing, come back unchanged.
 */
export function startRoundTimer(state: GameState, now: number): GameState {
  if (state.timerMs === null || state.phase !== 'placing') return state;
  return { ...state, deadline: now + state.timerMs };
}

/** Time left in the current timed round, or `null` when no countdown is running. */
export function roundTimeLeft(state: GameState, now: number): number | null {
  if (state.phase !== 'placing' || state.deadline === null) return null;
  return Math.max(0, state.deadline - now);
}

/**
 * If the round's time has run out at `now`, the players lose ('time-up'); with the
 * Real-time module the round ends instead and unplaced dice are lost. Otherwise the
 * same state object comes back, so callers can tell nothing changed.
 */
export function expireRoundTimer(state: GameState, now: number): GameState {
  if (roundTimeLeft(state, now) !== 0) return state;
  const s = structuredClone(state);
  if (modulesOf(s.scenario).some((m) => m.timeUpEndsRound)) endRound(s);
  else endGame(s, 'lost', 'time-up');
  return s;
}

/** Strategy phase is over: both players roll 4 dice behind their screens. */
export function rollDice(state: GameState): GameState {
  if (isGameOver(state)) throw new RuleError('game-over');
  if (state.phase !== 'strategy') throw new RuleError('not-strategy');
  const s = structuredClone(state);
  const prefix = `r${s.round}`;
  s.dice = {
    pilot: rollFor(
      s,
      ['p1', 'p2', 'p3', 'p4'].map((d) => `${prefix}-${d}`),
    ),
    copilot: rollFor(
      s,
      ['c1', 'c2', 'c3', 'c4'].map((d) => `${prefix}-${d}`),
    ),
  };
  s.phase = 'placing';
  s.currentSeat = currentAltitude(s).first;
  s.log.push({ type: 'roll', round: s.round, dice: structuredClone(s.dice) });
  return s;
}

function advanceApproach(state: GameState, steps: number): void {
  for (let i = 0; i < steps; i++) {
    if (state.approachPlanes[state.approachIndex]! > 0) return endGame(state, 'lost', 'collision');
    if (state.approachIndex === airportIndex(state)) return endGame(state, 'lost', 'overshoot');
    // Turns: every space flown out of checks the axis.
    const allowed = state.scenario.turns?.[state.approachIndex];
    if (allowed && !allowed.includes(state.axis)) return endGame(state, 'lost', 'turn');
    state.approachIndex++;
  }
}

/** Reroll tokens neither in the supply nor still waiting on the altitude track. */
function rerollTokensInBox(state: GameState): number {
  const onTrack = state.scenario.altitudes.slice(state.round).filter((a) => a.reroll).length;
  return REROLL_TOKENS - state.rerolls - onTrack;
}

/** Puts an Intern token or the traffic die on `slot` and resolves it like a die. */
const placeToken: Resolver = (state, seat, slot, value, source) => {
  const dieId = source === 'intern' ? `intern-${value}` : `r${state.round}-traffic`;
  state.placed[slot] = { seat, dieId, value, source };
  applySlotEffect(state, slot, value, seat);
};

function applySlotEffect(
  state: GameState,
  slot: SlotId,
  value: DieValue,
  seat: Seat,
  tokenSlot?: SlotId,
): void {
  const def = SLOTS[slot];
  if (def.module) {
    const extra = tokenSlot ? { tokenSlot, resolve: placeToken } : { resolve: placeToken };
    const reason = MODULES[def.module].place?.(state, seat, slot, value, extra);
    if (reason) endGame(state, 'lost', reason);
    return;
  }
  switch (def.group) {
    case 'axis': {
      const pilot = state.placed.axisPilot;
      const copilot = state.placed.axisCopilot;
      if (!pilot || !copilot) return;
      state.axis += pilot.value - copilot.value;
      if (Math.abs(state.axis) >= AXIS_LIMIT) return endGame(state, 'lost', 'spin');
      for (const module of modulesOf(state.scenario)) module.afterAxis?.(state);
      // Control: two equal Axis dice earn a coffee.
      if (state.abilities.includes('control') && pilot.value === copilot.value) {
        state.coffee = Math.min(MAX_COFFEE, state.coffee + 1);
      }
      return;
    }
    case 'engines': {
      const pilot = state.placed.enginePilot;
      const copilot = state.placed.engineCopilot;
      if (!pilot || !copilot) return;
      const bonus = modulesOf(state.scenario).reduce(
        (sum, m) => sum + (m.speedBonus?.(state) ?? 0),
        0,
      );
      state.speed = pilot.value + copilot.value + bonus;
      // Mastery: two equal Engine dice earn a reroll token, if one is left in the box.
      if (
        state.abilities.includes('mastery') &&
        pilot.value === copilot.value &&
        rerollTokensInBox(state) > 0
      ) {
        state.rerolls++;
      }
      // In the final round speed is compared with the brakes at landing instead.
      if (!isFinalRound(state)) {
        advanceApproach(state, approachSteps(state.speed, state.aeroBlue, state.aeroOrange));
      }
      return;
    }
    case 'radio': {
      const target = state.approachIndex + value - 1;
      if (target < state.approachPlanes.length && state.approachPlanes[target]! > 0) {
        state.approachPlanes[target]!--;
        state.planeSupply++;
      }
      return;
    }
    case 'gear':
      if (!state.gear[def.index]) {
        state.gear[def.index] = true;
        state.aeroBlue++;
      }
      return;
    case 'flaps':
      if (!state.flaps[def.index]) {
        state.flaps[def.index] = true;
        state.aeroOrange++;
      }
      return;
    case 'brakes':
      if (state.brakes === def.index) state.brakes++;
      return;
    case 'concentration':
      state.coffee = Math.min(MAX_COFFEE, state.coffee + 1);
      return;
  }
}

/** Hands the turn to the partner of `from`, or back to `from` if the partner cannot move. */
function nextTurn(state: GameState, from: Seat): void {
  for (const seat of [otherSeat(from), from]) {
    if (hasLegalMove(state, seat)) {
      state.currentSeat = seat;
      return;
    }
  }
  // Nobody can place another die: any leftover dice are lost and the round ends.
  endRound(state);
}

/** After a die changed value (reroll, ability), the seat on turn may be left without a move. */
export function settleTurn(state: GameState): void {
  if (state.phase === 'placing' && state.currentSeat && !hasLegalMove(state, state.currentSeat)) {
    nextTurn(state, state.currentSeat);
  }
}

const placedIn = (state: GameState, group: SlotGroup): boolean =>
  (Object.keys(state.placed) as SlotId[]).some((slot) => SLOTS[slot].group === group);

/**
 * Synchronisation: once a round has dice on both Landing Gear and Flaps, roll the traffic
 * die; the co-pilot places it right away on any empty space (an extra action this turn).
 * Returns whether the co-pilot now has that die to place.
 */
function synchronise(state: GameState, after: Seat): boolean {
  if (!state.abilities.includes('synchronisation') || state.abilityUse.synchronisation) {
    return false;
  }
  if (!placedIn(state, 'gear') || !placedIn(state, 'flaps')) return false;
  state.abilityUse.synchronisation = true;
  const die: Die = { id: `r${state.round}-traffic`, value: rollTrafficDie(state) };
  state.log.push({ type: 'bonus-die', round: state.round, die });
  state.bonus = { die, after };
  if (hasLegalMove(state, 'copilot')) {
    state.currentSeat = 'copilot';
    return true;
  }
  state.bonus = null; // Nowhere to put it.
  return false;
}

export function placeDie(state: GameState, seat: Seat, intent: PlaceIntent): GameState {
  const check = canPlaceDie(state, seat, intent);
  if (!check.ok) throw new RuleError(check.reason);

  const s = structuredClone(state);
  let placed: PlacedDie;
  let after = seat;
  if (s.bonus) {
    placed = { seat, dieId: s.bonus.die.id, value: s.bonus.die.value, source: 'traffic' };
    after = s.bonus.after;
    s.bonus = null;
  } else {
    const dice = s.dice[seat];
    const [die] = dice.splice(
      dice.findIndex((d) => d.id === intent.dieId),
      1,
    );
    s.coffee -= Math.abs(intent.coffeeDelta);
    placed = { seat, dieId: die!.id, value: (die!.value + intent.coffeeDelta) as DieValue };
  }
  s.placed[intent.slot] = placed;
  s.log.push({
    type: 'place',
    round: s.round,
    seat,
    dieId: placed.dieId,
    slot: intent.slot,
    coffeeDelta: intent.coffeeDelta,
    value: placed.value,
    ...(intent.tokenSlot && { tokenSlot: intent.tokenSlot }),
  });

  applySlotEffect(s, intent.slot, placed.value, seat, intent.tokenSlot);
  if (s.phase === 'placing' && !synchronise(s, after)) nextTurn(s, after);
  return s;
}

/** Landing conditions that failed; empty means a successful landing. */
export function checkLanding(state: GameState): EndReason[] {
  const failures: EndReason[] = [];
  if (state.approachPlanes.some((n) => n > 0)) failures.push('landing-traffic');
  if (!state.gear.every(Boolean)) failures.push('landing-gear');
  if (!state.flaps.every(Boolean)) failures.push('landing-flaps');
  if (state.axis !== 0) failures.push('landing-axis');
  if (state.speed === null || state.speed > brakeThreshold(state.brakes, state.scenario.modules)) {
    failures.push('landing-brakes');
  }
  for (const module of modulesOf(state.scenario)) failures.push(...(module.landing?.(state) ?? []));
  return failures;
}

function endRound(state: GameState): void {
  state.log.push({ type: 'round-end', round: state.round });
  state.bonus = null;
  state.swap = null;

  if (MANDATORY_SLOTS.some((slot) => !state.placed[slot])) {
    return endGame(state, 'lost', 'mandatory-missing');
  }
  for (const module of modulesOf(state.scenario)) {
    const reason = module.endOfRound?.(state);
    if (reason) return endGame(state, 'lost', reason);
  }

  if (isFinalRound(state)) {
    const failures = checkLanding(state);
    if (failures.length === 0) return endGame(state, 'won');
    state.landingFailures = failures;
    return endGame(state, 'lost', failures[0]);
  }

  // Descend 1000 feet and get ready for the next strategy discussion; the round timer stops.
  state.deadline = null;
  state.round++;
  state.placed = {};
  state.dice = { pilot: [], copilot: [] };
  state.speed = null;
  state.rerollPending = { pilot: false, copilot: false };
  state.abilityUse = {
    ...state.abilityUse,
    anticipation: false,
    workingTogether: false,
    synchronisation: false,
  };
  state.phase = 'strategy';
  const altitude = currentAltitude(state);
  state.currentSeat = altitude.first;
  if (altitude.reroll) state.rerolls++;

  if (isFinalRound(state) && state.approachIndex !== airportIndex(state)) {
    return endGame(state, 'lost', 'missed-airport');
  }
  rollTraffic(state);
}

/**
 * Ends the round once no one can place a die. Normally called for you by `placeDie`;
 * exposed so the server can recover a round explicitly.
 */
export function resolveRound(state: GameState): GameState {
  if (state.phase !== 'placing') throw new RuleError('not-placing');
  if (state.dice.pilot.length > 0 && hasLegalMove(state, 'pilot')) {
    throw new RuleError('not-your-turn');
  }
  if (state.dice.copilot.length > 0 && hasLegalMove(state, 'copilot')) {
    throw new RuleError('not-your-turn');
  }
  const s = structuredClone(state);
  endRound(s);
  return s;
}

export function canSpendReroll(
  state: Pick<GameState, 'phase' | 'rerolls' | 'rerollPending'> & { swap: object | null },
): MoveCheck {
  if (isGameOver(state)) return fail('game-over');
  if (state.phase !== 'placing') return fail('not-placing');
  if (state.rerolls < 1) return fail('no-reroll');
  if (state.rerollPending.pilot || state.rerollPending.copilot) return fail('reroll-pending');
  if (state.swap) return fail('swap-pending');
  return OK;
}

/** Any player may spend a token at any time; then BOTH players may reroll dice once. */
export function spendReroll(state: GameState, seat: Seat): GameState {
  const check = canSpendReroll(state);
  if (!check.ok) throw new RuleError(check.reason);
  const s = structuredClone(state);
  s.rerolls--;
  s.rerollPending = {
    pilot: s.dice.pilot.length > 0,
    copilot: s.dice.copilot.length > 0,
  };
  s.log.push({ type: 'reroll-spent', round: s.round, seat });
  return s;
}

export function canRerollDice(state: GameState, seat: Seat, dieIds: string[]): MoveCheck {
  if (isGameOver(state)) return fail('game-over');
  if (state.phase !== 'placing') return fail('not-placing');
  if (!state.rerollPending[seat]) return fail('no-reroll-pending');
  if (state.swap) return fail('swap-pending');
  if (new Set(dieIds).size !== dieIds.length) return fail('bad-reroll');
  const own = new Set(state.dice[seat].map((d) => d.id));
  if (!dieIds.every((id) => own.has(id))) return fail('unknown-die');
  return OK;
}

/** Rerolls the chosen dice (possibly none) and uses up this seat's reroll. */
export function rerollDice(state: GameState, seat: Seat, dieIds: string[]): GameState {
  const check = canRerollDice(state, seat, dieIds);
  if (!check.ok) throw new RuleError(check.reason);
  const s = structuredClone(state);
  const rolled = rollFor(s, dieIds);
  s.dice[seat] = s.dice[seat].map((d) => rolled.find((r) => r.id === d.id) ?? d);
  s.rerollPending[seat] = false;
  s.log.push({ type: 'reroll', round: s.round, seat, dice: rolled });
  // New values can leave the seat on turn without a legal move.
  settleTurn(s);
  return s;
}
