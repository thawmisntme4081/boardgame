import { describe, expect, it } from 'vitest';
import { MODULE_IDS, WIND_RING } from './modules';
import { PLANE_TOKENS, rollDice } from './rules';
import { AIRPORT_NAMES, DIFFICULTIES, SCENARIO_LIST, SCENARIOS, YUL } from './scenarios';
import { createGame } from './state';
import { play } from './test-utils';

describe('scenarios', () => {
  it('lists YUL and only well-formed entries (at most the 21 Flight Log scenarios)', () => {
    expect(SCENARIOS['yul-green']).toBe(YUL);
    expect(SCENARIO_LIST.length).toBeLessThanOrEqual(21);
    // One scenario per airport and colour, so ids never clash.
    expect(new Set(SCENARIO_LIST.map((s) => s.id)).size).toBe(SCENARIO_LIST.length);
    for (const s of SCENARIO_LIST) {
      expect(AIRPORT_NAMES[s.airport], s.id).toBeDefined();
      expect(DIFFICULTIES, s.id).toContain(s.difficulty);
      expect([0, 1, 2], s.id).toContain(s.abilities);
      expect(new Set(s.modules).size, s.id).toBe(s.modules.length);
      for (const m of s.modules) expect(MODULE_IDS, s.id).toContain(m);
      for (const turn of s.turns ?? []) {
        for (const p of turn ?? []) expect([-2, -1, 0, 1, 2], s.id).toContain(p);
      }
    }
  });

  it('lists them in Flight Log order: green, yellow, red, black', () => {
    const order = SCENARIO_LIST.map((s) => DIFFICULTIES.indexOf(s.difficulty));
    expect(order).toEqual([...order].sort((x, y) => x - y));
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
