import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ABILITY_IDS } from './abilities';
import { INTERN_TOKENS, WIND_RING } from './modules';
import { playRandomGame } from './random-play';
import { AXIS_LIMIT, MAX_COFFEE, PLANE_TOKENS } from './rules';
import { ALTITUDE_TRACKS, SCENARIO_LIST } from './scenarios';
import { testScenario } from './test-utils';
import type { GameState, Scenario } from './types';

/** Plain checks (not `expect`) so they stay cheap across thousands of steps. */
function checkInvariants(s: GameState): void {
  const broken: string[] = [];
  const check = (ok: boolean, what: string) => ok || broken.push(what);

  check(s.coffee >= 0 && s.coffee <= MAX_COFFEE, `coffee ${s.coffee}`);
  check(s.endReason === 'spin' || Math.abs(s.axis) < AXIS_LIMIT, `axis ${s.axis}`);
  check(s.aeroBlue === 4 + s.gear.filter(Boolean).length, `aeroBlue ${s.aeroBlue}`);
  check(s.aeroOrange === 8 + s.flaps.filter(Boolean).length, `aeroOrange ${s.aeroOrange}`);
  const maxBrakes = s.scenario.modules.includes('ice-brakes') ? 4 : 3;
  check(s.brakes >= 0 && s.brakes <= maxBrakes, `brakes ${s.brakes}`);
  check(
    s.planeSupply + s.approachPlanes.reduce((a, b) => a + b, 0) === PLANE_TOKENS,
    `planes ${s.planeSupply} in the box`,
  );
  check(s.kerosene === null || s.kerosene >= 0, `kerosene ${s.kerosene}`);
  check(s.intern === null || s.intern.length <= INTERN_TOKENS.length, 'intern tokens');
  check(s.wind === null || (s.wind >= 0 && s.wind < WIND_RING.length), `wind ${s.wind}`);
  check(!s.bonus || s.currentSeat === 'copilot', 'traffic die waiting for the pilot');
  check(
    s.approachIndex >= 0 && s.approachIndex < s.approachPlanes.length,
    `approachIndex ${s.approachIndex}`,
  );
  check(
    s.approachPlanes.every((n) => n >= 0),
    `planes ${s.approachPlanes.join()}`,
  );
  check(s.round >= 1 && s.round <= s.scenario.altitudes.length, `round ${s.round}`);
  check(s.dice.pilot.length <= 4 && s.dice.copilot.length <= 4, 'too many dice');
  check(
    s.dice.pilot.length + s.setAside.pilot <= 4 && s.dice.copilot.length + s.setAside.copilot <= 4,
    'too many dice with the set-aside ones',
  );
  check(
    !s.alarms || s.alarms.active.every((id) => !s.alarms!.faceDown.includes(id)),
    'an alarm both face up and face down',
  );
  check(s.rerolls >= 0, `rerolls ${s.rerolls}`);
  check(
    Object.values(s.placed).every((p) => p.value >= 1 && p.value <= 6),
    'placed die out of 1..6',
  );
  check(s.phase !== 'placing' || s.currentSeat !== null, 'placing without a seat on turn');

  if (broken.length > 0) throw new Error(`invariants broken: ${broken.join(', ')}`);
}

describe('random play', () => {
  it('1,000 random games always finish without throwing and keep invariants', () => {
    fc.assert(
      fc.property(fc.integer(), fc.boolean(), (seed, careful) => {
        const end = playRandomGame(seed, undefined, checkInvariants, careful);
        expect(['won', 'lost']).toContain(end.phase);
        if (end.phase === 'lost') expect(end.endReason).toBeDefined();
      }),
      { numRuns: 1000 },
    );
  }, 60_000);

  it('random games on every scenario finish and keep invariants', () => {
    for (const scenario of SCENARIO_LIST) {
      fc.assert(
        fc.property(
          fc.integer(),
          fc.boolean(),
          fc.shuffledSubarray([...ABILITY_IDS], {
            minLength: scenario.abilities,
            maxLength: scenario.abilities,
          }),
          (seed, careful, abilities) => {
            const end = playRandomGame(seed, scenario, checkInvariants, careful, abilities);
            expect(['won', 'lost']).toContain(end.phase);
            if (end.phase === 'lost') expect(end.endReason).toBeDefined();
          },
        ),
        { numRuns: 100 },
      );
    }
  }, 120_000);

  it('random games with every Turbulence feature finish and keep invariants', () => {
    const everywhere = [1, 1, 1, 1, 1, 1, 1];
    const turbulence: Scenario[] = [
      testScenario([0, 1, 1, 1, 1, 1, 1], {
        altitudes: ALTITUDE_TRACKS.D,
        modules: ['alarms', 'total-trust'],
        alarms: everywhere,
        totalTrust: [0, 1, 0, 1, 0, 1, 0],
        traffic: [1, 0, 1, 0, 1, 0, 0],
      }),
      testScenario([0, 1, 0, 1, 1, 0, 1], {
        altitudes: ALTITUDE_TRACKS.A,
        modules: ['belly-landing', 'alarms', 'intern'],
        alarms: everywhere,
      }),
      testScenario([0, 1, 1, 0, 1, 1, 0], {
        altitudes: ALTITUDE_TRACKS.C,
        modules: ['altitude-5000', 'wind-reversed', 'kerosene'],
      }),
      testScenario([0, 0, 1, 1, 1, 0, 1], {
        altitudes: ALTITUDE_TRACKS.B,
        modules: ['alarms', 'total-trust'],
        alarms: [2, 0, 1, 0, 1, 0, 0],
        totalTrust: everywhere,
      }),
    ];
    for (const scenario of turbulence) {
      fc.assert(
        fc.property(fc.integer(), fc.boolean(), (seed, careful) => {
          const end = playRandomGame(seed, scenario, checkInvariants, careful, ['synchronization']);
          expect(['won', 'lost']).toContain(end.phase);
        }),
        { numRuns: 200 },
      );
    }
  }, 120_000);

  it('replays exactly from the same seed', () => {
    expect(playRandomGame(2024)).toEqual(playRandomGame(2024));
  });
});
