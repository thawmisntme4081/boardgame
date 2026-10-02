import { describe, expect, it } from 'vitest';
import {
  approachSteps,
  canPlaceDie,
  canRerollDice,
  canSpendReroll,
  checkLanding,
  coffeeRange,
  legalMoves,
  placeDie,
  RuleError,
  rerollDice,
  rollDice,
  resolveRound,
  spendReroll,
} from './rules';
import { createGame } from './state';
import { QUIET_DICE, QUIET_ROUND, play, setupRound, testScenario } from './test-utils';
import type { GameState, PlaceIntent, Seat, SlotId } from './types';

const intent = (dieId: string, slot: SlotId, coffeeDelta = 0): PlaceIntent => ({
  dieId,
  slot,
  coffeeDelta,
});

const reason = (s: GameState, seat: Seat, i: PlaceIntent) => {
  const check = canPlaceDie(s, seat, i);
  return check.ok ? 'ok' : check.reason;
};

describe('turn order and placement basics', () => {
  it('lets only the seat on turn place, then alternates', () => {
    let s = setupRound(QUIET_DICE);
    expect(reason(s, 'copilot', intent('c1', 'axisCopilot'))).toBe('not-your-turn');
    s = placeDie(s, 'pilot', intent('p1', 'axisPilot'));
    expect(s.currentSeat).toBe('copilot');
    expect(reason(s, 'pilot', intent('p2', 'enginePilot'))).toBe('not-your-turn');
  });

  it('starts round 2 with the co-pilot (altitude arrow)', () => {
    const s = setupRound({ ...QUIET_DICE, patch: { round: 2 } });
    expect(s.currentSeat).toBe('copilot');
  });

  it('rejects placing outside the placing phase', () => {
    const s = createGame(testScenario(), 1);
    expect(reason(s, 'pilot', intent('p1', 'axisPilot'))).toBe('not-placing');
  });

  it('rejects dice the seat does not own and taken slots', () => {
    let s = setupRound(QUIET_DICE);
    expect(reason(s, 'pilot', intent('c1', 'axisPilot'))).toBe('unknown-die');
    s = play(s, [
      ['pilot', 'p1', 'concentration1'],
      ['copilot', 'c1', 'axisCopilot'],
    ]);
    expect(reason(s, 'pilot', intent('p2', 'concentration1'))).toBe('slot-taken');
  });

  it('enforces seat colors', () => {
    const s = setupRound({ pilot: [1, 2, 3, 4], copilot: [1, 2, 3, 4] });
    expect(reason(s, 'pilot', intent('p1', 'flaps1'))).toBe('wrong-seat');
    expect(reason(s, 'pilot', intent('p1', 'axisCopilot'))).toBe('wrong-seat');
    expect(reason(s, 'pilot', intent('p1', 'radioCopilot1'))).toBe('wrong-seat');
    expect(reason(s, 'pilot', intent('p1', 'concentration3'))).toBe('ok');
    const c = { ...s, currentSeat: 'copilot' as const };
    expect(reason(c, 'copilot', intent('c1', 'gear1'))).toBe('wrong-seat');
    expect(reason(c, 'copilot', intent('c2', 'brakes1'))).toBe('wrong-seat');
    expect(reason(c, 'copilot', intent('c1', 'concentration1'))).toBe('ok');
  });

  it('does not mutate the input state and logs the move', () => {
    const s = setupRound(QUIET_DICE);
    const before = structuredClone(s);
    const next = placeDie(s, 'pilot', intent('p1', 'axisPilot'));
    expect(s).toEqual(before);
    expect(next.log.at(-1)).toEqual({
      type: 'place',
      round: 1,
      seat: 'pilot',
      dieId: 'p1',
      slot: 'axisPilot',
      coffeeDelta: 0,
      value: 2,
    });
    expect(next.dice.pilot.map((d) => d.id)).toEqual(['p2', 'p3', 'p4']);
    expect(next.placed.axisPilot).toEqual({ seat: 'pilot', dieId: 'p1', value: 2 });
  });

  it('throws RuleError for an illegal move', () => {
    const s = setupRound(QUIET_DICE);
    expect(() => placeDie(s, 'copilot', intent('c1', 'axisCopilot'))).toThrow(RuleError);
  });

  it('lists legal moves for a seat', () => {
    const s = setupRound({ pilot: [6, 6, 6, 6], copilot: [1, 1, 1, 1] });
    const slots = new Set(legalMoves(s, 'pilot').map((m) => m.slot));
    expect(slots).toEqual(
      new Set([
        'axisPilot',
        'enginePilot',
        'radioPilot',
        'gear3',
        'concentration1',
        'concentration2',
        'concentration3',
      ]),
    );
    expect(legalMoves(s, 'pilot').every((m) => m.coffeeDelta === 0)).toBe(true);
  });

  it('gives the coffee range a die can take', () => {
    expect(coffeeRange(0, 3)).toEqual({ min: 0, max: 0 });
    expect(coffeeRange(2, 3)).toEqual({ min: -2, max: 2 });
    expect(coffeeRange(3, 1)).toEqual({ min: 0, max: 3 });
    expect(coffeeRange(3, 5)).toEqual({ min: -3, max: 1 });
    expect(Object.is(coffeeRange(0, 4).min, -0)).toBe(false);
  });

  it('never produces a -0 coffee delta (it would not survive JSON)', () => {
    const s = setupRound({ pilot: [3, 3], copilot: [3, 3] });
    expect(legalMoves(s, 'pilot').some((m) => Object.is(m.coffeeDelta, -0))).toBe(false);
  });
});

describe('axis', () => {
  const axisAfter = (pilot: 1 | 2 | 3 | 4 | 5 | 6, copilot: 1 | 2 | 3 | 4 | 5 | 6, axis = 0) =>
    play(setupRound({ pilot: [pilot, 3], copilot: [copilot, 3], patch: { axis } }), [
      ['pilot', 'p1', 'axisPilot'],
      ['copilot', 'c1', 'axisCopilot'],
    ]);

  it('tilts toward the higher die by the difference', () => {
    expect(axisAfter(5, 3).axis).toBe(-2);
    expect(axisAfter(3, 5).axis).toBe(2);
  });

  it('does not move on equal dice', () => {
    expect(axisAfter(4, 4).axis).toBe(0);
  });

  it('is not reset between rounds', () => {
    expect(axisAfter(3, 4, -1).axis).toBe(0);
    expect(axisAfter(4, 3, -1).axis).toBe(-2);
  });

  it('only moves once both axis dice are placed', () => {
    const s = play(setupRound({ pilot: [6, 3], copilot: [1, 3] }), [['pilot', 'p1', 'axisPilot']]);
    expect(s.axis).toBe(0);
  });

  it('spins at 3 marks either way', () => {
    expect(axisAfter(6, 4).phase).toBe('placing');
    const toPilot = axisAfter(6, 3);
    expect(toPilot.phase).toBe('lost');
    expect(toPilot.endReason).toBe('spin');
    expect(axisAfter(1, 2, 2).endReason).toBe('spin');
  });
});

describe('engines and approach', () => {
  it('maps speed to 0, 1 or 2 spaces using the aerodynamics markers', () => {
    expect(approachSteps(4, 4, 8)).toBe(0);
    expect(approachSteps(5, 4, 8)).toBe(1);
    expect(approachSteps(8, 4, 8)).toBe(1);
    expect(approachSteps(9, 4, 8)).toBe(2);
    // Blue marker moved once by the landing gear: 5 now stays put.
    expect(approachSteps(5, 5, 8)).toBe(0);
  });

  const engines = (pilot: 1 | 2 | 3 | 4 | 5 | 6, copilot: 1 | 2 | 3 | 4 | 5 | 6, extra = {}) =>
    play(setupRound({ pilot: [pilot, 3], copilot: [copilot, 3], ...extra }), [
      ['pilot', 'p1', 'enginePilot'],
      ['copilot', 'c1', 'engineCopilot'],
    ]);

  it('records speed and advances the approach track', () => {
    expect(engines(2, 2)).toMatchObject({ speed: 4, approachIndex: 0 });
    expect(engines(3, 2)).toMatchObject({ speed: 5, approachIndex: 1 });
    expect(engines(4, 4)).toMatchObject({ speed: 8, approachIndex: 1 });
    expect(engines(6, 3)).toMatchObject({ speed: 9, approachIndex: 2 });
  });

  it('survives planes moving into the current position', () => {
    const s = engines(3, 3, { approach: [0, 2, 0, 0, 0, 0, 0] });
    expect(s).toMatchObject({ phase: 'placing', approachIndex: 1 });
  });

  it('collides when advancing with planes in the current position', () => {
    const s = engines(3, 3, { approach: [1, 0, 0, 0, 0, 0, 0] });
    expect(s).toMatchObject({ phase: 'lost', endReason: 'collision' });
  });

  it('collides on the second step of a 2-space advance', () => {
    const s = engines(6, 6, { approach: [0, 1, 0, 0, 0, 0, 0] });
    expect(s).toMatchObject({ phase: 'lost', endReason: 'collision', approachIndex: 1 });
  });

  it('overshoots when advancing from the airport', () => {
    const s = engines(3, 3, { patch: { approachIndex: 6 } });
    expect(s).toMatchObject({ phase: 'lost', endReason: 'overshoot' });
    expect(engines(6, 6, { patch: { approachIndex: 5 } }).endReason).toBe('overshoot');
  });

  it('can hold at the airport by keeping speed low', () => {
    const s = engines(2, 2, { patch: { approachIndex: 6 } });
    expect(s).toMatchObject({ phase: 'placing', approachIndex: 6 });
  });
});

describe('radio', () => {
  const approach = [1, 2, 1, 0, 0, 0, 1];

  it('removes a plane counting from the current position', () => {
    let s = setupRound({ pilot: [1, 3], copilot: [3, 3], approach });
    s = placeDie(s, 'pilot', intent('p1', 'radioPilot'));
    expect(s.approachPlanes).toEqual([0, 2, 1, 0, 0, 0, 1]);
    s = placeDie(s, 'copilot', intent('c1', 'radioCopilot1'));
    expect(s.approachPlanes).toEqual([0, 2, 0, 0, 0, 0, 1]);
  });

  it('counts from the current position, not the start', () => {
    const s = play(
      setupRound({ pilot: [2, 3], copilot: [3], approach, patch: { approachIndex: 1 } }),
      [['pilot', 'p1', 'radioPilot']],
    );
    expect(s.approachPlanes).toEqual([1, 2, 0, 0, 0, 0, 1]);
  });

  it('does nothing on an empty space or past the end', () => {
    let s = setupRound({ pilot: [2, 3], copilot: [6, 3], approach, patch: { approachIndex: 3 } });
    s = play(s, [
      ['pilot', 'p1', 'radioPilot'], // space 4: empty
      ['copilot', 'c1', 'radioCopilot2'], // space 8: past the airport
    ]);
    expect(s.approachPlanes).toEqual(approach);
  });

  it('gives the co-pilot two radio slots and the pilot one', () => {
    let s = setupRound({ pilot: [2, 2, 3], copilot: [2, 3, 3], approach });
    s = play(s, [
      ['pilot', 'p1', 'radioPilot'],
      ['copilot', 'c1', 'radioCopilot1'],
    ]);
    expect(reason(s, 'pilot', intent('p2', 'radioPilot'))).toBe('slot-taken');
    s = play(s, [
      ['pilot', 'p2', 'concentration1'],
      ['copilot', 'c2', 'radioCopilot2'],
    ]);
    expect(s.approachPlanes).toEqual([1, 0, 0, 0, 0, 0, 1]);
  });
});

describe('landing gear', () => {
  it('only accepts the printed numbers', () => {
    const s = setupRound({ pilot: [1, 3, 5, 2], copilot: [1, 1, 1, 1] });
    expect(reason(s, 'pilot', intent('p1', 'gear1'))).toBe('ok');
    expect(reason(s, 'pilot', intent('p4', 'gear1'))).toBe('ok');
    expect(reason(s, 'pilot', intent('p1', 'gear2'))).toBe('value-not-allowed');
    expect(reason(s, 'pilot', intent('p2', 'gear2'))).toBe('ok');
    expect(reason(s, 'pilot', intent('p3', 'gear3'))).toBe('ok');
    expect(reason(s, 'pilot', intent('p3', 'gear1'))).toBe('value-not-allowed');
  });

  it('deploys in any order and moves the blue marker each time', () => {
    const s = play(setupRound({ pilot: [5, 1, 3], copilot: [1, 1, 1] }), [
      ['pilot', 'p1', 'gear3'],
      ['copilot', 'c1', 'concentration1'],
      ['pilot', 'p2', 'gear1'],
      ['copilot', 'c2', 'concentration2'],
      ['pilot', 'p3', 'gear2'],
    ]);
    expect(s.gear).toEqual([true, true, true]);
    expect(s.aeroBlue).toBe(7);
  });

  it('has no effect on a switch that is already green', () => {
    const s = play(
      setupRound({
        pilot: [1, 3],
        copilot: [1, 1],
        patch: { gear: [true, false, false], aeroBlue: 5 },
      }),
      [['pilot', 'p1', 'gear1']],
    );
    expect(s.gear).toEqual([true, false, false]);
    expect(s.aeroBlue).toBe(5);
  });
});

describe('flaps', () => {
  it('accepts 1/2, 2/3, 4/5, 5/6', () => {
    const s = setupRound({
      pilot: [1, 1],
      copilot: [2, 3, 4, 6],
      patch: { round: 2, flaps: [true, true, true, false], aeroOrange: 11 },
    });
    expect(reason(s, 'copilot', intent('c1', 'flaps1'))).toBe('ok');
    expect(reason(s, 'copilot', intent('c2', 'flaps2'))).toBe('ok');
    expect(reason(s, 'copilot', intent('c2', 'flaps3'))).toBe('value-not-allowed');
    expect(reason(s, 'copilot', intent('c3', 'flaps3'))).toBe('ok');
    expect(reason(s, 'copilot', intent('c4', 'flaps4'))).toBe('ok');
    expect(reason(s, 'copilot', intent('c3', 'flaps4'))).toBe('value-not-allowed');
  });

  it('must be deployed in order, and moves the orange marker', () => {
    let s = setupRound({ pilot: [1, 1], copilot: [2, 3, 4], patch: { round: 2 } });
    expect(reason(s, 'copilot', intent('c2', 'flaps2'))).toBe('out-of-order');
    s = play(s, [
      ['copilot', 'c1', 'flaps1'],
      ['pilot', 'p1', 'concentration1'],
    ]);
    expect(reason(s, 'copilot', intent('c3', 'flaps3'))).toBe('out-of-order');
    s = placeDie(s, 'copilot', intent('c2', 'flaps2'));
    expect(s.flaps).toEqual([true, true, false, false]);
    expect(s.aeroOrange).toBe(10);
  });
});

describe('brakes', () => {
  it('must be deployed 2, then 4, then 6', () => {
    let s = setupRound({ pilot: [4, 2, 6, 4], copilot: [1, 1, 1, 1] });
    expect(reason(s, 'pilot', intent('p1', 'brakes2'))).toBe('out-of-order');
    expect(reason(s, 'pilot', intent('p1', 'brakes1'))).toBe('value-not-allowed');
    s = play(s, [
      ['pilot', 'p2', 'brakes1'],
      ['copilot', 'c1', 'concentration1'],
    ]);
    expect(s.brakes).toBe(1);
    expect(reason(s, 'pilot', intent('p3', 'brakes3'))).toBe('out-of-order');
    s = play(s, [
      ['pilot', 'p1', 'brakes2'],
      ['copilot', 'c2', 'concentration2'],
      ['pilot', 'p3', 'brakes3'],
    ]);
    expect(s.brakes).toBe(3);
  });

  it('has no effect on a brake that is already deployed', () => {
    const s = play(setupRound({ pilot: [2, 3], copilot: [1, 1], patch: { brakes: 2 } }), [
      ['pilot', 'p1', 'brakes1'],
    ]);
    expect(s.brakes).toBe(2);
  });
});

describe('concentration and coffee', () => {
  it('earns one coffee per die, up to 3', () => {
    let s = setupRound({ pilot: [6, 6, 6], copilot: [1, 1, 1] });
    s = play(s, [
      ['pilot', 'p1', 'concentration1'],
      ['copilot', 'c1', 'concentration2'],
    ]);
    expect(s.coffee).toBe(2);
    const full = play(setupRound({ pilot: [6, 6], copilot: [1, 1], patch: { coffee: 3 } }), [
      ['pilot', 'p1', 'concentration1'],
    ]);
    expect(full.coffee).toBe(3);
  });

  it('spends coffee to change a die by 1 per token', () => {
    const s = play(setupRound({ pilot: [3, 3], copilot: [1, 1], patch: { coffee: 2 } }), [
      ['pilot', 'p1', 'radioPilot', -2],
    ]);
    expect(s.coffee).toBe(0);
    expect(s.placed.radioPilot?.value).toBe(1);
  });

  it('lets coffee unlock a number constraint', () => {
    const s = setupRound({ pilot: [3, 3], copilot: [1, 1], patch: { coffee: 1 } });
    expect(reason(s, 'pilot', intent('p1', 'brakes1'))).toBe('value-not-allowed');
    expect(reason(s, 'pilot', intent('p1', 'brakes1', -1))).toBe('ok');
  });

  it('cannot spend more coffee than available, or leave 1..6', () => {
    const s = setupRound({ pilot: [6, 1], copilot: [1, 1], patch: { coffee: 1 } });
    expect(reason(s, 'pilot', intent('p2', 'axisPilot', -2))).toBe('not-enough-coffee');
    expect(reason(s, 'pilot', intent('p1', 'axisPilot', 1))).toBe('value-out-of-range');
    expect(reason(s, 'pilot', intent('p2', 'axisPilot', -1))).toBe('value-out-of-range');
    expect(reason(s, 'pilot', intent('p2', 'axisPilot', 0.5))).toBe('bad-coffee');
  });

  it('is shared: coffee from one seat can be spent by the other', () => {
    const s = play(setupRound({ pilot: [6, 6], copilot: [3, 4] }), [
      ['pilot', 'p1', 'concentration1'],
      ['copilot', 'c1', 'flaps1', -1],
    ]);
    expect(s).toMatchObject({ coffee: 0, flaps: [true, false, false, false] });
  });

  it('keeps unspent coffee for the next round', () => {
    const s = play(setupRound({ ...QUIET_DICE, patch: { coffee: 0 } }), QUIET_ROUND);
    expect(s.round).toBe(2);
    expect(s.coffee).toBe(2);
  });
});

describe('end of round', () => {
  it('descends after all 8 dice and prepares the next round', () => {
    const s = play(setupRound(QUIET_DICE), QUIET_ROUND);
    expect(s).toMatchObject({
      phase: 'strategy',
      round: 2,
      currentSeat: 'copilot',
      placed: {},
      dice: { pilot: [], copilot: [] },
      speed: null,
    });
    expect(s.log.some((e) => e.type === 'round-end' && e.round === 1)).toBe(true);
  });

  it('loses when a mandatory space is empty', () => {
    const s = play(setupRound(QUIET_DICE), [
      ['pilot', 'p1', 'axisPilot'],
      ['copilot', 'c1', 'axisCopilot'],
      ['pilot', 'p2', 'enginePilot'],
      ['copilot', 'c2', 'concentration1'],
      ['pilot', 'p3', 'concentration2'],
      ['copilot', 'c3', 'concentration3'],
      ['pilot', 'p4', 'radioPilot'],
      ['copilot', 'c4', 'radioCopilot1'],
    ]);
    expect(s).toMatchObject({ phase: 'lost', endReason: 'mandatory-missing' });
  });

  it('picks up the 2000 ft reroll token only', () => {
    const at4000 = play(
      setupRound({ ...QUIET_DICE, patch: { round: 2, rerolls: 0 } }),
      copilotFirst(QUIET_ROUND),
    );
    expect(at4000).toMatchObject({ round: 3, rerolls: 0 });
    const at2000 = play(
      setupRound({ ...QUIET_DICE, patch: { round: 4, rerolls: 0 } }),
      copilotFirst(QUIET_ROUND),
    );
    expect(at2000).toMatchObject({ round: 5, rerolls: 1 });
  });

  it('crashes when the last altitude arrives before the airport', () => {
    const s = play(setupRound({ ...QUIET_DICE, patch: { round: 6 } }), [
      ...copilotFirst(QUIET_ROUND),
    ]);
    expect(s).toMatchObject({ phase: 'lost', endReason: 'missed-airport', round: 7 });
  });

  it('starts the final round when the airport and the last altitude line up', () => {
    const s = play(
      setupRound({ ...QUIET_DICE, patch: { round: 6, approachIndex: 6 } }),
      copilotFirst(QUIET_ROUND),
    );
    expect(s).toMatchObject({ phase: 'strategy', round: 7, currentSeat: 'pilot' });
  });

  it('skips a seat that cannot move and ends the round when nobody can', () => {
    // Pilot's only die is a 6 and every space that could take it is full.
    const placedByPatch = {
      axisPilot: { seat: 'pilot', dieId: 'x1', value: 3 },
      axisCopilot: { seat: 'copilot', dieId: 'x2', value: 3 },
      enginePilot: { seat: 'pilot', dieId: 'x3', value: 2 },
      engineCopilot: { seat: 'copilot', dieId: 'x4', value: 2 },
      radioPilot: { seat: 'pilot', dieId: 'x5', value: 6 },
      gear3: { seat: 'pilot', dieId: 'x6', value: 6 },
      concentration1: { seat: 'pilot', dieId: 'x7', value: 1 },
      concentration2: { seat: 'copilot', dieId: 'x8', value: 1 },
      concentration3: { seat: 'copilot', dieId: 'x9', value: 1 },
    } as const;
    let s = setupRound({
      pilot: [6],
      copilot: [2, 3],
      patch: { round: 2, placed: placedByPatch },
    });
    expect(legalMoves(s, 'pilot')).toEqual([]);
    s = placeDie(s, 'copilot', intent('c1', 'flaps1'));
    expect(s.currentSeat).toBe('copilot');
    s = placeDie(s, 'copilot', intent('c2', 'flaps2'));
    expect(s).toMatchObject({ phase: 'strategy', round: 3 });
  });

  it('resolveRound refuses while someone can still move', () => {
    expect(() => resolveRound(setupRound(QUIET_DICE))).toThrow(RuleError);
  });
});

/** Same moves, with each pair swapped so the co-pilot places first (even rounds). */
function copilotFirst(moves: typeof QUIET_ROUND): typeof QUIET_ROUND {
  const out: typeof QUIET_ROUND = [];
  for (let i = 0; i < moves.length; i += 2) out.push(moves[i + 1]!, moves[i]!);
  return out;
}

describe('the finished round (lastRound)', () => {
  it('keeps the round’s dice and speed after it ends, until the next roll', () => {
    const played = play(setupRound(QUIET_DICE), QUIET_ROUND);
    expect(played.round).toBe(2);
    expect(played.placed).toEqual({});
    expect(played.lastRound?.speed).toBe(4);
    expect(Object.keys(played.lastRound!.placed)).toHaveLength(8);
    expect(played.lastRound!.placed.axisPilot).toEqual({ seat: 'pilot', dieId: 'p1', value: 2 });
    expect(rollDice(played).lastRound).toBeNull();
  });

  it('is empty in a new game', () => {
    expect(createGame(testScenario(), 1).lastRound).toBeNull();
  });
});

describe('final round and landing', () => {
  const ready: Partial<GameState> = {
    round: 7,
    approachIndex: 6,
    gear: [true, true, true],
    flaps: [true, true, true, true],
    aeroBlue: 7,
    aeroOrange: 12,
    brakes: 2,
  };

  const land = (
    pilotEngine: 1 | 2 | 3 | 4 | 5 | 6,
    patch: Partial<GameState> = {},
    approach?: number[],
  ) =>
    play(
      setupRound({
        pilot: [3, pilotEngine, 3, 3],
        copilot: [3, 2, 3, 3],
        approach,
        patch: { ...ready, ...patch },
      }),
      [
        ['pilot', 'p1', 'axisPilot'],
        ['copilot', 'c1', 'axisCopilot'],
        ['pilot', 'p2', 'enginePilot'],
        ['copilot', 'c2', 'engineCopilot'],
        ['pilot', 'p3', 'concentration1'],
        ['copilot', 'c3', 'concentration2'],
        ['pilot', 'p4', 'radioPilot'],
        ['copilot', 'c4', 'radioCopilot1'],
      ],
    );

  it('wins when every landing condition is met', () => {
    const s = land(2);
    expect(s.phase).toBe('won');
    expect(s.endReason).toBeUndefined();
    expect(s.log.at(-1)).toEqual({ type: 'game-end', round: 7, result: 'won' });
  });

  it('compares final speed with the brakes instead of advancing', () => {
    // Speed 8 would normally advance and overshoot; here it only fails the brakes.
    const s = land(6);
    expect(s.approachIndex).toBe(6);
    expect(s).toMatchObject({ phase: 'lost', endReason: 'landing-brakes' });
  });

  it('needs speed at or below the brake marker', () => {
    // Brakes 2 and 4 deployed: marker between 4 and 5.
    expect(land(2).phase).toBe('won'); // speed 4
    expect(land(3).endReason).toBe('landing-brakes'); // speed 5
    expect(land(1, { brakes: 1 }).endReason).toBe('landing-brakes'); // speed 3 vs 2
    expect(land(1, { brakes: 0 }).endReason).toBe('landing-brakes');
  });

  it('fails with traffic left on the approach track', () => {
    expect(
      land(
        2,
        {},
        [0, 0, 0, 0, 0, 0, 0].map((_, i) => (i === 2 ? 1 : 0)),
      ).endReason,
    ).toBe('landing-traffic');
  });

  it('fails without all landing gear or flaps', () => {
    expect(land(2, { gear: [true, false, true] }).endReason).toBe('landing-gear');
    expect(land(2, { flaps: [true, true, true, false] }).endReason).toBe('landing-flaps');
  });

  it('fails when the plane is not level', () => {
    expect(land(2, { axis: 1 }).endReason).toBe('landing-axis');
  });

  it('reports every failed condition', () => {
    const s = land(6, { axis: -1, gear: [false, true, true] });
    expect(s.landingFailures).toEqual(['landing-gear', 'landing-axis', 'landing-brakes']);
  });

  it('checkLanding is empty for a perfect landing state', () => {
    const s = { ...setupRound({ pilot: [], copilot: [], patch: ready }), speed: 3 };
    expect(checkLanding(s)).toEqual([]);
  });
});

describe('rerolls', () => {
  it('spending a token lets both players reroll once', () => {
    let s = setupRound(QUIET_DICE);
    expect(s.rerolls).toBe(1);
    s = spendReroll(s, 'copilot');
    expect(s.rerolls).toBe(0);
    expect(s.rerollPending).toEqual({ pilot: true, copilot: true });
    expect(canSpendReroll({ ...s, rerolls: 1 })).toEqual({ ok: false, reason: 'reroll-pending' });

    const before = s.dice.pilot;
    s = rerollDice(s, 'pilot', ['p1', 'p3']);
    expect(s.dice.pilot.map((d) => d.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(s.dice.pilot[1]).toEqual(before[1]);
    expect(s.dice.pilot[3]).toEqual(before[3]);
    expect(s.rerollPending).toEqual({ pilot: false, copilot: true });
    expect(canRerollDice(s, 'pilot', ['p2'])).toEqual({ ok: false, reason: 'no-reroll-pending' });

    s = rerollDice(s, 'copilot', []);
    expect(s.rerollPending).toEqual({ pilot: false, copilot: false });
  });

  it('is deterministic for the same seed', () => {
    const a = rerollDice(spendReroll(setupRound(QUIET_DICE), 'pilot'), 'pilot', ['p1', 'p2']);
    const b = rerollDice(spendReroll(setupRound(QUIET_DICE), 'pilot'), 'pilot', ['p1', 'p2']);
    expect(a.dice).toEqual(b.dice);
  });

  it('needs a token and only rerolls your own dice once each', () => {
    expect(canSpendReroll(setupRound({ ...QUIET_DICE, patch: { rerolls: 0 } }))).toEqual({
      ok: false,
      reason: 'no-reroll',
    });
    const s = spendReroll(setupRound(QUIET_DICE), 'pilot');
    expect(canRerollDice(s, 'pilot', ['c1'])).toEqual({ ok: false, reason: 'unknown-die' });
    expect(canRerollDice(s, 'pilot', ['p1', 'p1'])).toEqual({ ok: false, reason: 'bad-reroll' });
  });

  it('clears unused rerolls at the end of the round, keeping spare tokens', () => {
    let s = setupRound({ ...QUIET_DICE, patch: { rerolls: 2 } });
    s = spendReroll(s, 'pilot');
    s = play(s, QUIET_ROUND);
    expect(s.rerollPending).toEqual({ pilot: false, copilot: false });
    expect(s.rerolls).toBe(1);
  });
});
