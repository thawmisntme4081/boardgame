import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { playRandomGame } from './random-play';
import { AXIS_LIMIT, MAX_COFFEE } from './rules';
import type { GameState } from './types';

/** Plain checks (not `expect`) so they stay cheap across thousands of steps. */
function checkInvariants(s: GameState): void {
  const broken: string[] = [];
  const check = (ok: boolean, what: string) => ok || broken.push(what);

  check(s.coffee >= 0 && s.coffee <= MAX_COFFEE, `coffee ${s.coffee}`);
  check(s.endReason === 'spin' || Math.abs(s.axis) < AXIS_LIMIT, `axis ${s.axis}`);
  check(s.aeroBlue === 4 + s.gear.filter(Boolean).length, `aeroBlue ${s.aeroBlue}`);
  check(s.aeroOrange === 8 + s.flaps.filter(Boolean).length, `aeroOrange ${s.aeroOrange}`);
  check(s.brakes >= 0 && s.brakes <= 3, `brakes ${s.brakes}`);
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

  it('replays exactly from the same seed', () => {
    expect(playRandomGame(2024)).toEqual(playRandomGame(2024));
  });
});
