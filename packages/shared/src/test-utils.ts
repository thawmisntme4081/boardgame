// Helpers for building exact game situations in tests.
import { placeDie, rollDice } from './rules';
import { BASE_ALTITUDES } from './scenarios';
import { createGame } from './state';
import type { AbilityId, DieValue, GameState, Scenario, Seat, SlotId } from './types';

export function testScenario(
  approach: number[] = [0, 0, 0, 0, 0, 0, 0],
  extra: Partial<Scenario> = {},
): Scenario {
  return {
    id: 'test',
    airport: 'TST',
    name: 'Test',
    difficulty: 'green',
    altitudes: BASE_ALTITUDES,
    approach,
    modules: [],
    abilities: 0,
    ...extra,
  };
}

interface RoundSetup {
  pilot: DieValue[];
  copilot: DieValue[];
  approach?: number[];
  /** Applied before rolling, e.g. `{ round: 7, approachIndex: 6 }`. */
  patch?: Partial<GameState>;
  /** Scenario fields on top of the test scenario, e.g. `{ modules: ['kerosene'] }`. */
  scenario?: Partial<Scenario>;
  abilities?: AbilityId[];
}

/** A game in the `placing` phase with fixed dice: pilot `p1..pN`, co-pilot `c1..cN`. */
export function setupRound({
  pilot,
  copilot,
  approach,
  patch,
  scenario,
  abilities,
}: RoundSetup): GameState {
  const game = createGame(testScenario(approach, scenario), 42, { abilities });
  const state = rollDice({ ...game, ...patch });
  state.dice = {
    pilot: pilot.map((value, i) => ({ id: `p${i + 1}`, value })),
    copilot: copilot.map((value, i) => ({ id: `c${i + 1}`, value })),
  };
  return state;
}

export type Move = [seat: Seat, dieId: string, slot: SlotId, coffeeDelta?: number];

export function play(state: GameState, moves: Move[]): GameState {
  return moves.reduce(
    (s, [seat, dieId, slot, coffeeDelta = 0]) => placeDie(s, seat, { dieId, slot, coffeeDelta }),
    state,
  );
}

/** A full, harmless round: level axis, speed 4 (no movement at the start markers). */
export const QUIET_ROUND: Move[] = [
  ['pilot', 'p1', 'axisPilot'],
  ['copilot', 'c1', 'axisCopilot'],
  ['pilot', 'p2', 'enginePilot'],
  ['copilot', 'c2', 'engineCopilot'],
  ['pilot', 'p3', 'concentration1'],
  ['copilot', 'c3', 'concentration2'],
  ['pilot', 'p4', 'radioPilot'],
  ['copilot', 'c4', 'radioCopilot1'],
];
export const QUIET_DICE: { pilot: DieValue[]; copilot: DieValue[] } = {
  pilot: [2, 2, 3, 3],
  copilot: [2, 2, 3, 3],
};
