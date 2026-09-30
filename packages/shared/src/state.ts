import { ABILITY_IDS, freshAbilityUse } from './abilities';
import { modulesOf } from './modules';
import { PLANE_TOKENS, rollTraffic } from './rules';
import type { AbilityId, GameState, Scenario } from './types';

/** Blue Aerodynamics marker starts between 4 and 5. */
export const AERO_BLUE_START = 4;
/** Orange Aerodynamics marker starts between 8 and 9. */
export const AERO_ORANGE_START = 8;

/** Default length of a timed round: from the roll until the last die is placed. */
export const ROUND_TIMER_MS = 3 * 60_000;

export interface GameOptions {
  /** Round timer in ms, or `null` (the default) for an untimed game. */
  timerMs?: number | null;
  /** Special Ability cards the players chose (the scenario says how many). */
  abilities?: readonly AbilityId[];
}

function validateScenario(scenario: Scenario): void {
  const first = scenario.altitudes[0];
  if (!first) throw new Error(`scenario ${scenario.id} has no altitudes`);
  const length = scenario.approach.length;
  if (length < 2) throw new Error(`scenario ${scenario.id} approach too short`);
  if (scenario.traffic && scenario.traffic.length !== length) {
    throw new Error(`scenario ${scenario.id} traffic does not match the approach`);
  }
  if (scenario.turns && scenario.turns.length !== length) {
    throw new Error(`scenario ${scenario.id} turns do not match the approach`);
  }
  if (scenario.approach.reduce((a, b) => a + b, 0) > PLANE_TOKENS) {
    throw new Error(`scenario ${scenario.id} needs more than ${PLANE_TOKENS} planes`);
  }
}

export function createGame(
  scenario: Scenario,
  seed: number,
  { timerMs = null, abilities = [] }: GameOptions = {},
): GameState {
  validateScenario(scenario);
  if (
    new Set(abilities).size !== abilities.length ||
    abilities.some((a) => !ABILITY_IDS.includes(a))
  ) {
    throw new Error(`bad abilities: ${abilities.join(', ')}`);
  }
  const first = scenario.altitudes[0]!;

  const state: GameState = {
    scenario,
    phase: 'strategy',
    round: 1,
    currentSeat: first.first,
    dice: { pilot: [], copilot: [] },
    placed: {},
    axis: 0,
    approachIndex: 0,
    approachPlanes: [...scenario.approach],
    aeroBlue: AERO_BLUE_START,
    aeroOrange: AERO_ORANGE_START,
    gear: [false, false, false],
    flaps: [false, false, false, false],
    brakes: 0,
    coffee: 0,
    // The reroll token on the first altitude goes straight to the supply.
    rerolls: first.reroll ? 1 : 0,
    rerollPending: { pilot: false, copilot: false },
    speed: null,
    rngSeed: seed,
    rngState: seed,
    abilities: [...abilities],
    abilityUse: freshAbilityUse(),
    kerosene: null,
    intern: null,
    wind: null,
    planeSupply: PLANE_TOKENS - scenario.approach.reduce((a, b) => a + b, 0),
    traffic: [],
    bonus: null,
    swap: null,
    log: [],
    timerMs,
    deadline: null,
  };
  for (const module of modulesOf(scenario)) module.setup?.(state);
  rollTraffic(state);
  return state;
}
