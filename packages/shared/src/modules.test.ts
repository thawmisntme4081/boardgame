import { describe, expect, it } from 'vitest';
import { KEROSENE_START, REAL_TIME_MS, WIND_RING } from './modules';
import {
  canPlaceDie,
  checkLanding,
  landingConditions,
  expireRoundTimer,
  PLANE_TOKENS,
  placeDie,
  startRoundTimer,
  TRAFFIC_DIE,
} from './rules';
import { createGame } from './state';
import { QUIET_DICE, QUIET_ROUND, play, setupRound, testScenario, type Move } from './test-utils';
import type { GameEvent, GameState, ModuleId, PlaceIntent, Scenario, Seat, SlotId } from './types';

const intent = (dieId: string, slot: SlotId, coffeeDelta = 0): PlaceIntent => ({
  dieId,
  slot,
  coffeeDelta,
});

const reason = (s: GameState, seat: Seat, i: PlaceIntent) => {
  const check = canPlaceDie(s, seat, i);
  return check.ok ? 'ok' : check.reason;
};

const withModules = (...modules: ModuleId[]): Partial<Scenario> => ({ modules });

/** Axis level and speed 4 with dice `p1`/`c1` (axis) and `p2`/`c2` (engines) worth 2. */
const MANDATORY: Move[] = QUIET_ROUND.slice(0, 4);

describe('kerosene', () => {
  const KEROSENE = withModules('kerosene');

  it('starts at 20; a die of any value burns that much', () => {
    let s = setupRound({ pilot: [5, 2, 3, 3], copilot: [2, 2, 3, 3], scenario: KEROSENE });
    expect(s.kerosene).toBe(KEROSENE_START);
    s = placeDie(s, 'pilot', intent('p1', 'kerosene'));
    expect(s.kerosene).toBe(15);
  });

  it('can be used by either player', () => {
    let s = setupRound({ ...QUIET_DICE, scenario: KEROSENE });
    s = placeDie(s, 'pilot', intent('p1', 'axisPilot'));
    expect(reason(s, 'copilot', intent('c3', 'kerosene'))).toBe('ok');
  });

  it('burns 6 at the end of a round with no die on it, and nothing more with one', () => {
    const idle = play(setupRound({ ...QUIET_DICE, scenario: KEROSENE }), QUIET_ROUND);
    expect(idle.round).toBe(2);
    expect(idle.kerosene).toBe(KEROSENE_START - 6);

    const used = play(setupRound({ ...QUIET_DICE, scenario: KEROSENE }), [
      ...MANDATORY,
      ['pilot', 'p3', 'kerosene'],
      ['copilot', 'c3', 'concentration1'],
      ['pilot', 'p4', 'radioPilot'],
      ['copilot', 'c4', 'radioCopilot1'],
    ]);
    expect(used.round).toBe(2);
    expect(used.kerosene).toBe(KEROSENE_START - 3);
  });

  it('loses the moment the marker reaches the X', () => {
    const s = setupRound({
      pilot: [5, 2, 3, 3],
      copilot: [2, 2, 3, 3],
      scenario: KEROSENE,
      patch: { kerosene: 5 },
    });
    const after = placeDie(s, 'pilot', intent('p1', 'kerosene'));
    expect(after.phase).toBe('lost');
    expect(after.endReason).toBe('kerosene');
    expect(after.kerosene).toBe(0);
  });

  it('loses when the end-of-round 6 empties the tank', () => {
    const s = play(
      setupRound({ ...QUIET_DICE, scenario: KEROSENE, patch: { kerosene: 6 } }),
      QUIET_ROUND,
    );
    expect(s.phase).toBe('lost');
    expect(s.endReason).toBe('kerosene');
  });

  it('has no Kerosene space without the module', () => {
    const s = setupRound(QUIET_DICE);
    expect(s.kerosene).toBeNull();
    expect(reason(s, 'pilot', intent('p1', 'kerosene'))).toBe('unknown-slot');
  });
});

describe('kerosene leak', () => {
  const LEAK = withModules('kerosene-leak');

  it('burns the difference between the engine dice + 1 each round', () => {
    const s = play(setupRound({ pilot: [2, 5, 3, 3], copilot: [2, 2, 3, 3], scenario: LEAK }), [
      ['pilot', 'p1', 'axisPilot'],
      ['copilot', 'c1', 'axisCopilot'],
      ['pilot', 'p2', 'enginePilot'],
      ['copilot', 'c2', 'engineCopilot'],
      ['pilot', 'p3', 'concentration1'],
      ['copilot', 'c3', 'concentration2'],
      ['pilot', 'p4', 'radioPilot'],
      ['copilot', 'c4', 'radioCopilot1'],
    ]);
    expect(s.round).toBe(2);
    expect(s.kerosene).toBe(KEROSENE_START - (5 - 2 + 1));
  });

  it('has no Kerosene space to play on', () => {
    const s = setupRound({ ...QUIET_DICE, scenario: LEAK });
    expect(reason(s, 'pilot', intent('p1', 'kerosene'))).toBe('unknown-slot');
  });

  it('loses when the leak empties the tank', () => {
    const s = play(
      setupRound({ ...QUIET_DICE, scenario: LEAK, patch: { kerosene: 1 } }),
      QUIET_ROUND,
    );
    expect(s.endReason).toBe('kerosene');
  });
});

describe('intern', () => {
  const INTERN = withModules('intern');
  const TOKENS: GameState['intern'] = [2, 6, 4, 3, 5, 1];
  const train = (dieId: string, slot: SlotId, tokenSlot?: SlotId, coffeeDelta = 0): PlaceIntent =>
    tokenSlot ? { dieId, slot, coffeeDelta, tokenSlot } : { dieId, slot, coffeeDelta };

  it('lays the six tokens out in a random order that the seed fixes', () => {
    const a = createGame(testScenario(undefined, INTERN), 7);
    expect([...a.intern!].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(createGame(testScenario(undefined, INTERN), 7).intern).toEqual(a.intern);
    expect(createGame(testScenario(), 7).intern).toBeNull();
  });

  it('a die on your space takes the token closest to you; it resolves like a die', () => {
    let s = setupRound({
      pilot: [5, 2, 3, 3],
      copilot: [2, 2, 3, 3],
      approach: [0, 1, 0, 0, 0, 0, 0],
      scenario: INTERN,
      patch: { intern: TOKENS },
    });
    const supply = s.planeSupply;
    s = placeDie(s, 'pilot', train('p1', 'internPilot', 'radioPilot'));
    expect(s.intern).toEqual([6, 4, 3, 5, 1]);
    expect(s.placed.internPilot).toMatchObject({ seat: 'pilot', value: 5 });
    expect(s.placed.radioPilot).toEqual({
      seat: 'pilot',
      dieId: 'intern-2',
      value: 2,
      source: 'intern',
    });
    // Radio 2 clears the plane one space ahead.
    expect(s.approachPlanes[1]).toBe(0);
    expect(s.planeSupply).toBe(supply + 1);
    expect(s.currentSeat).toBe('copilot');
  });

  it('the co-pilot takes from the other end; a token can fill a mandatory space', () => {
    let s = setupRound({ ...QUIET_DICE, scenario: INTERN, patch: { intern: TOKENS } });
    s = placeDie(s, 'pilot', intent('p1', 'axisPilot'));
    s = placeDie(s, 'copilot', train('c1', 'internCopilot', 'axisCopilot'));
    expect(s.intern).toEqual([2, 6, 4, 3, 5]);
    // Pilot 2, intern token 1: one mark toward the pilot.
    expect(s.axis).toBe(-1);
  });

  it('refuses a die showing the next token value; coffee can change the die, not the token', () => {
    let s = setupRound({ ...QUIET_DICE, scenario: INTERN, patch: { intern: TOKENS, coffee: 1 } });
    expect(reason(s, 'pilot', train('p1', 'internPilot', 'radioPilot'))).toBe('intern-same-value');
    s = placeDie(s, 'pilot', train('p1', 'internPilot', 'radioPilot', 1));
    expect(s.placed.internPilot?.value).toBe(3);
    expect(s.placed.radioPilot?.value).toBe(2);
    expect(s.coffee).toBe(0);
  });

  it('checks where the token goes', () => {
    const s = setupRound({
      pilot: [5, 2, 3, 3],
      copilot: [2, 2, 3, 3],
      scenario: INTERN,
      patch: { intern: [6, 4, 3, 5, 1, 2] },
    });
    expect(reason(s, 'pilot', train('p1', 'internPilot'))).toBe('bad-token-slot');
    expect(reason(s, 'pilot', train('p1', 'internPilot', 'concentration1'))).toBe('bad-token-slot');
    expect(reason(s, 'pilot', train('p1', 'internPilot', 'internCopilot'))).toBe('bad-token-slot');
    expect(reason(s, 'pilot', train('p1', 'internPilot', 'gear1'))).toBe('value-not-allowed');
    expect(reason(s, 'pilot', train('p1', 'internPilot', 'axisCopilot'))).toBe('wrong-seat');
    expect(reason(s, 'pilot', train('p1', 'internPilot', 'gear3'))).toBe('ok');
    expect(reason(s, 'pilot', train('p1', 'axisPilot', 'gear3'))).toBe('bad-token-slot');
  });

  it('has nothing to train once the board is empty', () => {
    const s = setupRound({ ...QUIET_DICE, scenario: INTERN, patch: { intern: [] } });
    expect(reason(s, 'pilot', train('p1', 'internPilot', 'radioPilot'))).toBe('no-intern-token');
  });

  it('loses the landing with tokens left on the board', () => {
    const s = createGame(testScenario(undefined, INTERN), 1);
    expect(checkLanding(s)).toContain('landing-intern');
    expect(checkLanding({ ...s, intern: [] })).not.toContain('landing-intern');
  });
});

describe('wind', () => {
  const WIND = withModules('wind');

  it('turns the ring by the axis after the axis phase and adds the wind to the engines', () => {
    let s = setupRound({ pilot: [4, 1, 3, 3], copilot: [2, 1, 3, 3], scenario: WIND });
    expect(s.wind).toBe(0);
    s = play(s, [
      ['pilot', 'p1', 'axisPilot'],
      ['copilot', 'c1', 'axisCopilot'],
    ]);
    // Two marks toward the pilot: two spaces to the left.
    expect(s.axis).toBe(-2);
    expect(s.wind).toBe(WIND_RING.length - 2);
    s = play(s, [
      ['pilot', 'p2', 'enginePilot'],
      ['copilot', 'c2', 'engineCopilot'],
    ]);
    expect(s.speed).toBe(2 + WIND_RING[WIND_RING.length - 2]!);
  });

  it('turns even when the axis did not move, and toward the co-pilot to the right', () => {
    const toPilot = play(setupRound({ ...QUIET_DICE, scenario: WIND, patch: { axis: -1 } }), [
      ['pilot', 'p1', 'axisPilot'],
      ['copilot', 'c1', 'axisCopilot'],
    ]);
    expect(toPilot.axis).toBe(-1);
    expect(toPilot.wind).toBe(WIND_RING.length - 1);

    const toCopilot = play(setupRound({ ...QUIET_DICE, scenario: WIND, patch: { axis: 1 } }), [
      ['pilot', 'p1', 'axisPilot'],
      ['copilot', 'c1', 'axisCopilot'],
    ]);
    expect(toCopilot.wind).toBe(1);
  });

  it('adds the wind in the final round too', () => {
    const s = play(
      setupRound({ ...QUIET_DICE, scenario: WIND, patch: { round: 7, approachIndex: 6, wind: 3 } }),
      MANDATORY,
    );
    expect(s.speed).toBe(4 + WIND_RING[3]!);
  });
});

describe('ice brakes', () => {
  const ICE = withModules('ice-brakes');

  it('cover the normal brakes', () => {
    const s = setupRound({ ...QUIET_DICE, scenario: ICE });
    expect(reason(s, 'pilot', intent('p1', 'brakes1'))).toBe('unknown-slot');
    expect(reason(s, 'pilot', intent('p1', 'ice2Top'))).toBe('ok');
  });

  it('need two dice of the column value, above (pilot) and below (either), then go on', () => {
    let s = setupRound({ ...QUIET_DICE, scenario: ICE });
    expect(reason(s, 'pilot', intent('p3', 'ice2Top'))).toBe('value-not-allowed');
    expect(reason(s, 'pilot', intent('p3', 'ice3Top'))).toBe('out-of-order');
    s = placeDie(s, 'pilot', intent('p1', 'ice2Top'));
    expect(s.brakes).toBe(0);
    expect(reason(s, 'copilot', intent('c1', 'ice2Top'))).toBe('slot-taken');
    s = placeDie(s, 'copilot', intent('c1', 'ice2Bottom'));
    expect(s.brakes).toBe(1);
    // More than one column in the same round.
    s = play(s, [
      ['pilot', 'p3', 'ice3Top'],
      ['copilot', 'c3', 'ice3Bottom'],
    ]);
    expect(s.brakes).toBe(2);
  });

  it('keep the top row for the pilot; the pilot may fill both rows', () => {
    let s = setupRound({ ...QUIET_DICE, scenario: ICE });
    s = placeDie(s, 'pilot', intent('p3', 'axisPilot'));
    expect(reason(s, 'copilot', intent('c1', 'ice2Top'))).toBe('wrong-seat');
    s = play(s, [
      ['copilot', 'c3', 'axisCopilot'],
      ['pilot', 'p1', 'ice2Top'],
      ['copilot', 'c4', 'engineCopilot'],
      ['pilot', 'p2', 'ice2Bottom'],
    ]);
    expect(s.brakes).toBe(1);
  });

  it('lose a die with no partner at the end of the round; no playing behind the marker', () => {
    const s = play(setupRound({ pilot: [2, 2, 2, 3], copilot: [2, 2, 3, 3], scenario: ICE }), [
      ...MANDATORY,
      ['pilot', 'p3', 'ice2Top'],
      ['copilot', 'c3', 'concentration2'],
      ['pilot', 'p4', 'radioPilot'],
      ['copilot', 'c4', 'radioCopilot1'],
    ]);
    expect(s.round).toBe(2);
    expect(s.brakes).toBe(0);
    expect(s.placed.ice2Top).toBeUndefined();

    const past = setupRound({ ...QUIET_DICE, scenario: ICE, patch: { brakes: 1 } });
    expect(reason(past, 'pilot', intent('p1', 'ice2Top'))).toBe('out-of-order');
  });

  it('must end past the 5, with the speed below the marker', () => {
    const base: GameState = {
      ...createGame(testScenario(undefined, ICE), 1),
      gear: [true, true, true],
      flaps: [true, true, true, true],
      brakes: 4,
      speed: 5,
    };
    expect(checkLanding(base)).toEqual([]);
    expect(checkLanding({ ...base, speed: 6 })).toEqual(['landing-brakes']);
    expect(checkLanding({ ...base, brakes: 3, speed: 4 })).toEqual(['landing-ice-brakes']);
  });
});

describe('real-time', () => {
  const REAL = withModules('real-time');

  it('times every round at 60 seconds, lobby timer or not', () => {
    expect(createGame(testScenario(undefined, REAL), 1).timerMs).toBe(REAL_TIME_MS);
    expect(createGame(testScenario(undefined, REAL), 1, { timerMs: 180_000 }).timerMs).toBe(
      REAL_TIME_MS,
    );
  });

  it('ends the round when time runs out: unplaced dice are lost', () => {
    let s = play(setupRound({ ...QUIET_DICE, scenario: REAL }), MANDATORY);
    s = startRoundTimer(s, 0);
    expect(expireRoundTimer(s, REAL_TIME_MS - 1)).toBe(s);
    const next = expireRoundTimer(s, REAL_TIME_MS);
    expect(next.phase).toBe('strategy');
    expect(next.round).toBe(2);
    expect(next.deadline).toBeNull();
  });

  it('loses when the axis or engines were not filled in time', () => {
    const s = startRoundTimer(
      play(setupRound({ ...QUIET_DICE, scenario: REAL }), MANDATORY.slice(0, 3)),
      0,
    );
    const after = expireRoundTimer(s, REAL_TIME_MS);
    expect(after.phase).toBe('lost');
    expect(after.endReason).toBe('mandatory-missing');
  });
});

describe('traffic die (approach track effect)', () => {
  const trafficEvents = (s: GameState) =>
    s.log.filter((e): e is Extract<GameEvent, { type: 'traffic' }> => e.type === 'traffic');

  it('rolls once per icon on the current space and adds planes that many spaces ahead', () => {
    const s = createGame(
      testScenario([0, 0, 0, 0, 0, 0, 0], { traffic: [2, 0, 0, 0, 0, 0, 0] }),
      5,
    );
    const [event] = trafficEvents(s);
    expect(event?.rolls).toHaveLength(2);
    const expected = [0, 0, 0, 0, 0, 0, 0];
    for (const roll of event!.rolls) {
      expect(TRAFFIC_DIE).toContain(roll);
      expected[roll - 1]!++;
    }
    expect(s.approachPlanes).toEqual(expected);
    expect(s.planeSupply).toBe(PLANE_TOKENS - 2);
  });

  it('keeps this round’s rolls and where each plane went, for the players to see', () => {
    const s = createGame(
      testScenario([0, 0, 0, 0, 0, 0, 0], { traffic: [2, 0, 0, 0, 0, 0, 0] }),
      5,
    );
    const [event] = trafficEvents(s);
    expect(s.traffic.map((t) => t.roll)).toEqual(event!.rolls);
    for (const { roll, space } of s.traffic) expect(space).toBe(roll - 1);

    const empty = createGame(testScenario([0, 4, 4, 4], { traffic: [1, 0, 0, 0] }), 3);
    expect(empty.traffic).toEqual([{ roll: expect.any(Number), space: null }]);

    // Next round on a space without icons: nothing new to show.
    const next = play(
      setupRound({
        pilot: [2, 5, 3, 3],
        copilot: [2, 5, 3, 3],
        scenario: { traffic: [1, 0, 0, 0, 0, 0, 0] },
      }),
      QUIET_ROUND,
    );
    expect(next.round).toBe(2);
    expect(next.traffic).toEqual([]);
  });

  it('puts planes beyond the track on the airport', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createGame(testScenario([0, 0], { traffic: [1, 0] }), seed);
      expect(s.approachPlanes).toEqual([0, 1]);
    }
  });

  it('adds no plane when the box is empty', () => {
    const s = createGame(testScenario([0, 4, 4, 4], { traffic: [1, 0, 0, 0] }), 3);
    expect(trafficEvents(s)).toHaveLength(1);
    expect(s.approachPlanes).toEqual([0, 4, 4, 4]);
    expect(s.planeSupply).toBe(0);
  });

  it('rolls again each round on the space, but not for spaces flown through', () => {
    const traffic = [1, 0, 0, 0, 0, 0, 0];
    const stay = play(
      setupRound({ ...QUIET_DICE, approach: [0, 0, 0, 0, 0, 0, 0], scenario: { traffic } }),
      QUIET_ROUND,
    );
    expect(stay.approachIndex).toBe(0);
    expect(trafficEvents(stay).map((e) => e.round)).toEqual([1, 2]);

    const through = play(
      setupRound({
        pilot: [2, 5, 3, 3],
        copilot: [2, 5, 3, 3],
        scenario: { traffic: [0, 1, 0, 0, 0, 0, 0] },
      }),
      QUIET_ROUND,
    );
    // Speed 10: two spaces, past the traffic icon on space 1.
    expect(through.approachIndex).toBe(2);
    expect(trafficEvents(through)).toEqual([]);
  });
});

describe('turns (approach track effect)', () => {
  const turn = (
    turns: Scenario['turns'],
    patch: Partial<GameState>,
    engines: [2 | 3 | 5, 2 | 3 | 5],
  ) =>
    play(
      setupRound({
        pilot: [2, engines[0], 3, 3],
        copilot: [2, engines[1], 3, 3],
        scenario: { turns },
        patch,
      }),
      MANDATORY,
    );
  const LEFT = [-2, -1];
  const none = [null, null, null, null, null, null];

  it('loses when the track advances with the axis outside the permitted positions', () => {
    const s = turn([LEFT, ...none], {}, [3, 3]);
    expect(s.phase).toBe('lost');
    expect(s.endReason).toBe('turn');
  });

  it('lets the plane through with the axis in a permitted position', () => {
    const s = turn([LEFT, ...none], { axis: -1 }, [3, 3]);
    expect(s.phase).toBe('placing');
    expect(s.approachIndex).toBe(1);
  });

  it('checks both spaces when advancing two', () => {
    const s = turn([null, LEFT, null, null, null, null, null], {}, [5, 5]);
    expect(s.endReason).toBe('turn');
    expect(s.approachIndex).toBe(1);
  });

  it('does not apply when the track does not move', () => {
    const s = turn([LEFT, ...none], {}, [2, 2]);
    expect(s.phase).toBe('placing');
    expect(s.approachIndex).toBe(0);
  });
});

describe('landing conditions', () => {
  it('list the base five, plus the ones a module adds', () => {
    const base = [
      'landing-traffic',
      'landing-gear',
      'landing-flaps',
      'landing-axis',
      'landing-brakes',
    ];
    expect(landingConditions({ modules: [] })).toEqual(base);
    expect(landingConditions({ modules: ['intern', 'ice-brakes'] })).toEqual([
      ...base,
      'landing-intern',
      'landing-ice-brakes',
    ]);
    expect(landingConditions({ modules: ['wind'] })).toEqual(base);
  });
});
