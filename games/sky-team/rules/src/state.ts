import { ABILITY_IDS, freshAbilityUse } from './abilities';
import { modulesOf } from './modules';
import { freshCrew } from './crew';
import { NEXT_TURN_MS, PLANE_TOKENS, startRound } from './rules';
import type { AbilityId, Crew, GameState, Scenario } from './types';

/** Blue Aerodynamics marker starts between 4 and 5. */
export const AERO_BLUE_START = 4;
/** Orange Aerodynamics marker starts between 8 and 9. */
export const AERO_ORANGE_START = 8;

/** Default length of a timed round: from the roll until the last die is placed. */
export const ROUND_TIMER_MS = 3 * 60_000;

export interface GameOptions {
  /** Wait in the `setup` phase until `beginGame` (roles and abilities chosen in the game). */
  setup?: boolean;
  /** Round timer in ms, or `null` (the default) for an untimed game. */
  timerMs?: number | null;
  /** Special Ability cards the players chose (the scenario says how many). */
  abilities?: readonly AbilityId[];
  /** Total Trust: the pause before the dice roll by themselves (tests shorten it). */
  autoRollDelayMs?: number;
  /** The crew as the platform seated it (everyone seated, the pilot hosting, by default). */
  crew?: Crew;
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
  for (const field of ['alarms', 'totalTrust'] as const) {
    if (scenario[field] && scenario[field].length !== length) {
      throw new Error(`scenario ${scenario.id} ${field} do not match the approach`);
    }
  }
  if (scenario.approach.reduce((a, b) => a + b, 0) > PLANE_TOKENS) {
    throw new Error(`scenario ${scenario.id} needs more than ${PLANE_TOKENS} planes`);
  }
}

export function createGame(
  catalogScenario: Scenario,
  seed: number,
  {
    timerMs = null,
    abilities = [],
    setup = false,
    autoRollDelayMs = NEXT_TURN_MS,
    crew = freshCrew(),
  }: GameOptions = {},
): GameState {
  // Modules may change the altitude track (Altitude 5000 starts one space lower).
  const scenario: Scenario = {
    ...catalogScenario,
    altitudes: modulesOf(catalogScenario).reduce(
      (track, module) => module.altitudes?.(track) ?? track,
      catalogScenario.altitudes,
    ),
  };
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
    lastRound: null,
    rngSeed: seed,
    rngState: seed,
    abilities: [...abilities],
    abilityUse: freshAbilityUse(),
    kerosene: null,
    intern: null,
    wind: null,
    alarms: null,
    autoRoll: false,
    setAside: { pilot: 0, copilot: 0 },
    planeSupply: PLANE_TOKENS - scenario.approach.reduce((a, b) => a + b, 0),
    traffic: [],
    bonus: null,
    swap: null,
    log: [],
    timerMs,
    deadline: null,
    autoRollAt: null,
    autoRollDelayMs,
    crew: structuredClone(crew),
  };
  const modules = modulesOf(scenario);
  for (const module of modules) module.setup?.(state, modules);
  // Online games wait for the crew; round 1 (traffic die included) starts in `beginGame`.
  if (setup) state.phase = 'setup';
  else startRound(state);
  return state;
}
