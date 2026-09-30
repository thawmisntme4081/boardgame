import { describe, expect, it } from 'vitest';
import { WIND_RING } from './modules';
import { PLANE_TOKENS, rollDice } from './rules';
import { SCENARIO_LIST, SCENARIOS, YUL } from './scenarios';
import { createGame } from './state';
import { play } from './test-utils';
import type { Difficulty } from './types';

describe('scenarios', () => {
  it('has the 21 Flight Log scenarios on 11 airports', () => {
    expect(SCENARIO_LIST).toHaveLength(21);
    expect(new Set(SCENARIO_LIST.map((s) => s.airport)).size).toBe(11);
    expect(Object.keys(SCENARIOS)).toHaveLength(21);
    const count = (difficulty: Difficulty) =>
      SCENARIO_LIST.filter((s) => s.difficulty === difficulty).length;
    expect([count('green'), count('yellow'), count('red'), count('black')]).toEqual([6, 7, 5, 3]);
    expect(SCENARIOS.yul).toBe(YUL);
  });

  it('uses the modules and ability counts printed on the cards', () => {
    const summary = Object.fromEntries(
      SCENARIO_LIST.map((s) => [s.id, `${s.modules.join('+') || '-'} ${s.abilities}`]),
    );
    expect(summary).toEqual({
      yul: '- 0',
      'lhr-green': '- 0',
      'hnd-green': '- 0',
      'osl-green': 'kerosene 0',
      'atl-green': 'intern 0',
      'prg-green': 'kerosene 2',
      'lhr-yellow': 'intern 0',
      'tgu-yellow': 'kerosene 2',
      'gig-yellow': 'wind 1',
      'kef-yellow': 'ice-brakes 1',
      'prg-yellow': 'kerosene-leak 2',
      'kul-yellow': 'kerosene 1',
      'atl-yellow': 'kerosene-leak 1',
      'pbh-red': 'kerosene+real-time 2',
      'hnd-red': 'intern 1',
      'gig-red': 'wind+kerosene-leak 2',
      'osl-red': 'kerosene-leak+ice-brakes 2',
      'tgu-red': 'kerosene+wind 2',
      'kef-black': 'wind+ice-brakes 2',
      'kul-black': 'kerosene+real-time 2',
      'pbh-black': 'kerosene+real-time 2',
    });
  });

  it('every scenario starts a valid game', () => {
    for (const scenario of SCENARIO_LIST) {
      const game = createGame(scenario, 1);
      expect(game.approachPlanes.length).toBe(scenario.approach.length);
      expect(game.scenario.altitudes).toHaveLength(7);
    }
  });

  it('can reach the airport: at most 2 spaces per round before the final one', () => {
    for (const scenario of SCENARIO_LIST) {
      const advances = scenario.approach.length - 1;
      expect(advances).toBeLessThanOrEqual(2 * (scenario.altitudes.length - 1));
    }
  });

  it('every scenario can be won from a prepared final round, module conditions included', () => {
    for (const scenario of SCENARIO_LIST) {
      const game = createGame(scenario, 1);
      const calmest = WIND_RING.indexOf(Math.min(...WIND_RING));
      const s = rollDice({
        ...game,
        round: scenario.altitudes.length,
        approachIndex: scenario.approach.length - 1,
        approachPlanes: scenario.approach.map(() => 0),
        planeSupply: PLANE_TOKENS,
        gear: [true, true, true],
        flaps: [true, true, true, true],
        aeroBlue: 7,
        aeroOrange: 12,
        brakes: scenario.modules.includes('ice-brakes') ? 4 : 3,
        intern: game.intern && [],
        wind: game.wind === null ? null : calmest,
      });
      s.dice = {
        pilot: [1, 2, 3, 4].map((n) => ({ id: `p${n}`, value: 1 })),
        copilot: [1, 2, 3, 4].map((n) => ({ id: `c${n}`, value: 1 })),
      };
      const end = play(s, [
        ['pilot', 'p1', 'axisPilot'],
        ['copilot', 'c1', 'axisCopilot'],
        ['pilot', 'p2', 'enginePilot'],
        ['copilot', 'c2', 'engineCopilot'],
        ['pilot', 'p3', 'concentration1'],
        ['copilot', 'c3', 'concentration2'],
        ['pilot', 'p4', 'radioPilot'],
        ['copilot', 'c4', 'radioCopilot1'],
      ]);
      expect({ id: scenario.id, phase: end.phase, failures: end.landingFailures }).toEqual({
        id: scenario.id,
        phase: 'won',
        failures: undefined,
      });
    }
  });
});
