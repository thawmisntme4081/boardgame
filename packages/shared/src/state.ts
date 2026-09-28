import type { GameState, Scenario } from './types';

/** Blue Aerodynamics marker starts between 4 and 5. */
export const AERO_BLUE_START = 4;
/** Orange Aerodynamics marker starts between 8 and 9. */
export const AERO_ORANGE_START = 8;

export function createGame(scenario: Scenario, seed: number): GameState {
  const first = scenario.altitudes[0];
  if (!first) throw new Error(`scenario ${scenario.id} has no altitudes`);
  if (scenario.approach.length < 2) throw new Error(`scenario ${scenario.id} approach too short`);

  return {
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
    log: [],
  };
}
