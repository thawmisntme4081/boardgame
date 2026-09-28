import { rollDie } from './rng';
import { MANDATORY_SLOTS, SLOT_IDS, SLOTS } from './slots';
import type {
  AltitudeSpace,
  Die,
  DieValue,
  EndReason,
  GameState,
  MoveCheck,
  MoveError,
  PlaceIntent,
  Seat,
  SlotId,
} from './types';

/** The Axis Arrow reaching this many marks from level is a spin. */
export const AXIS_LIMIT = 3;
export const MAX_COFFEE = 3;
export const DICE_PER_SEAT = 4;
/** Brake marker position by brakes deployed: left of 2, then past 2, 4 and 6. Speed must not exceed it. */
export const BRAKE_THRESHOLDS: readonly number[] = [1, 2, 4, 6];

/** Thrown when a rule function is called with a move that `can*` would reject. */
export class RuleError extends Error {
  constructor(readonly reason: MoveError) {
    super(reason);
    this.name = 'RuleError';
  }
}

export const otherSeat = (seat: Seat): Seat => (seat === 'pilot' ? 'copilot' : 'pilot');

export function currentAltitude(state: GameState): AltitudeSpace {
  const space = state.scenario.altitudes[state.round - 1];
  if (!space) throw new Error(`no altitude for round ${state.round}`);
  return space;
}

export const isFinalRound = (state: GameState): boolean =>
  state.round === state.scenario.altitudes.length;

export const airportIndex = (state: GameState): number => state.approachPlanes.length - 1;

export const isGameOver = (state: GameState): boolean =>
  state.phase === 'won' || state.phase === 'lost';

/** How many spaces the Approach Track advances for a given speed: 0, 1 or 2. */
export function approachSteps(speed: number, aeroBlue: number, aeroOrange: number): 0 | 1 | 2 {
  if (speed <= aeroBlue) return 0;
  if (speed <= aeroOrange) return 1;
  return 2;
}

export const brakeThreshold = (brakes: number): number =>
  BRAKE_THRESHOLDS[Math.min(brakes, BRAKE_THRESHOLDS.length - 1)]!;

const fail = (reason: MoveError): MoveCheck => ({ ok: false, reason });
const OK: MoveCheck = { ok: true };

/** Colour, number, order and coffee checks, ignoring phase and turn. */
function checkPlacement(state: GameState, seat: Seat, intent: PlaceIntent): MoveCheck {
  const die = state.dice[seat].find((d) => d.id === intent.dieId);
  if (!die) return fail('unknown-die');
  const def = SLOTS[intent.slot];
  if (!def) return fail('unknown-slot');
  if (state.placed[intent.slot]) return fail('slot-taken');
  if (!def.seats.includes(seat)) return fail('wrong-seat');

  const { coffeeDelta } = intent;
  if (!Number.isInteger(coffeeDelta)) return fail('bad-coffee');
  if (Math.abs(coffeeDelta) > state.coffee) return fail('not-enough-coffee');
  const value = die.value + coffeeDelta;
  if (value < 1 || value > 6) return fail('value-out-of-range');
  if (def.values && !def.values.includes(value as DieValue)) return fail('value-not-allowed');

  if (def.group === 'flaps' && !state.flaps.slice(0, def.index).every(Boolean)) {
    return fail('out-of-order');
  }
  if (def.group === 'brakes' && state.brakes < def.index) return fail('out-of-order');
  return OK;
}

export function canPlaceDie(state: GameState, seat: Seat, intent: PlaceIntent): MoveCheck {
  if (isGameOver(state)) return fail('game-over');
  if (state.phase !== 'placing') return fail('not-placing');
  if (state.currentSeat !== seat) return fail('not-your-turn');
  return checkPlacement(state, seat, intent);
}

/** Every legal placement for `seat`'s dice, ignoring whose turn it is. */
export function legalMoves(state: GameState, seat: Seat): PlaceIntent[] {
  if (state.phase !== 'placing') return [];
  const moves: PlaceIntent[] = [];
  for (const die of state.dice[seat]) {
    for (const slot of SLOT_IDS) {
      for (let coffeeDelta = -state.coffee; coffeeDelta <= state.coffee; coffeeDelta++) {
        const intent = { dieId: die.id, slot, coffeeDelta };
        if (checkPlacement(state, seat, intent).ok) moves.push(intent);
      }
    }
  }
  return moves;
}

function hasLegalMove(state: GameState, seat: Seat): boolean {
  return state.dice[seat].some((die) =>
    SLOT_IDS.some((slot) => {
      for (let coffeeDelta = -state.coffee; coffeeDelta <= state.coffee; coffeeDelta++) {
        if (checkPlacement(state, seat, { dieId: die.id, slot, coffeeDelta }).ok) return true;
      }
      return false;
    }),
  );
}

function rollFor(state: GameState, ids: string[]): Die[] {
  return ids.map((id) => {
    const r = rollDie(state.rngState);
    state.rngState = r.rngState;
    return { id, value: r.value };
  });
}

const endGame = (state: GameState, result: 'won' | 'lost', reason?: EndReason): void => {
  state.phase = result;
  state.currentSeat = null;
  if (reason) state.endReason = reason;
  state.log.push({ type: 'game-end', round: state.round, result, ...(reason && { reason }) });
};

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
    state.approachIndex++;
  }
}

function applySlotEffect(state: GameState, slot: SlotId, value: DieValue): void {
  const def = SLOTS[slot];
  switch (def.group) {
    case 'axis': {
      const pilot = state.placed.axisPilot;
      const copilot = state.placed.axisCopilot;
      if (!pilot || !copilot) return;
      state.axis += pilot.value - copilot.value;
      if (Math.abs(state.axis) >= AXIS_LIMIT) endGame(state, 'lost', 'spin');
      return;
    }
    case 'engines': {
      const pilot = state.placed.enginePilot;
      const copilot = state.placed.engineCopilot;
      if (!pilot || !copilot) return;
      state.speed = pilot.value + copilot.value;
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

/** Hands the turn to the partner, or back to the same seat if the partner cannot move. */
function nextTurn(state: GameState): void {
  const current = state.currentSeat ?? currentAltitude(state).first;
  for (const seat of [otherSeat(current), current]) {
    if (hasLegalMove(state, seat)) {
      state.currentSeat = seat;
      return;
    }
  }
  // Nobody can place another die: any leftover dice are lost and the round ends.
  endRound(state);
}

export function placeDie(state: GameState, seat: Seat, intent: PlaceIntent): GameState {
  const check = canPlaceDie(state, seat, intent);
  if (!check.ok) throw new RuleError(check.reason);

  const s = structuredClone(state);
  const dice = s.dice[seat];
  const [die] = dice.splice(
    dice.findIndex((d) => d.id === intent.dieId),
    1,
  );
  const value = (die!.value + intent.coffeeDelta) as DieValue;
  s.coffee -= Math.abs(intent.coffeeDelta);
  s.placed[intent.slot] = { seat, dieId: die!.id, value };
  s.log.push({
    type: 'place',
    round: s.round,
    seat,
    dieId: die!.id,
    slot: intent.slot,
    coffeeDelta: intent.coffeeDelta,
    value,
  });

  applySlotEffect(s, intent.slot, value);
  if (s.phase === 'placing') nextTurn(s);
  return s;
}

/** Landing conditions that failed; empty means a successful landing. */
export function checkLanding(state: GameState): EndReason[] {
  const failures: EndReason[] = [];
  if (state.approachPlanes.some((n) => n > 0)) failures.push('landing-traffic');
  if (!state.gear.every(Boolean)) failures.push('landing-gear');
  if (!state.flaps.every(Boolean)) failures.push('landing-flaps');
  if (state.axis !== 0) failures.push('landing-axis');
  if (state.speed === null || state.speed > brakeThreshold(state.brakes)) {
    failures.push('landing-brakes');
  }
  return failures;
}

function endRound(state: GameState): void {
  state.log.push({ type: 'round-end', round: state.round });

  if (MANDATORY_SLOTS.some((slot) => !state.placed[slot])) {
    return endGame(state, 'lost', 'mandatory-missing');
  }

  if (isFinalRound(state)) {
    const failures = checkLanding(state);
    if (failures.length === 0) return endGame(state, 'won');
    state.landingFailures = failures;
    return endGame(state, 'lost', failures[0]);
  }

  // Descend 1000 feet and get ready for the next strategy discussion.
  state.round++;
  state.placed = {};
  state.dice = { pilot: [], copilot: [] };
  state.speed = null;
  state.rerollPending = { pilot: false, copilot: false };
  state.phase = 'strategy';
  const altitude = currentAltitude(state);
  state.currentSeat = altitude.first;
  if (altitude.reroll) state.rerolls++;

  if (isFinalRound(state) && state.approachIndex !== airportIndex(state)) {
    endGame(state, 'lost', 'missed-airport');
  }
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

export function canSpendReroll(state: GameState): MoveCheck {
  if (isGameOver(state)) return fail('game-over');
  if (state.phase !== 'placing') return fail('not-placing');
  if (state.rerolls < 1) return fail('no-reroll');
  if (state.rerollPending.pilot || state.rerollPending.copilot) return fail('reroll-pending');
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
  if (s.currentSeat && !hasLegalMove(s, s.currentSeat)) nextTurn(s);
  return s;
}
