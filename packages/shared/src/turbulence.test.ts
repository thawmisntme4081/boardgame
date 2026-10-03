import { describe, expect, it } from 'vitest';
import { ALARM_IDS } from './modules';
import {
  BAD_VISIBILITY_HAND,
  canPlaceDie,
  checkLanding,
  landingConditions,
  placeDie,
  rollDice,
} from './rules';
import { ALTITUDE_TRACKS, BASE_ALTITUDES, HARD_ALTITUDES, scenarioIds } from './scenarios';
import { createGame } from './state';
import { play, setupRound, testScenario } from './test-utils';
import type { AlarmId, GameState, PlaceIntent, Scenario, Seat, SlotId } from './types';
import { viewFor } from './views';

const intent = (dieId: string, slot: SlotId, coffeeDelta = 0): PlaceIntent => ({
  dieId,
  slot,
  coffeeDelta,
});

const reason = (s: GameState, seat: Seat, i: PlaceIntent) => {
  const check = canPlaceDie(s, seat, i);
  return check.ok ? 'ok' : check.reason;
};

const weatherEvents = (s: GameState) => s.log.filter((e) => e.type === 'weather');

describe('altitude tracks A–D', () => {
  const events = (track: keyof typeof ALTITUDE_TRACKS) =>
    ALTITUDE_TRACKS[track].map(({ altitude, turbulence, badVisibility }) =>
      [altitude, turbulence ? 'T' : '', badVisibility ? 'BV' : ''].join(''),
    );

  it('place the confirmed weather on each altitude', () => {
    expect(events('A')).toEqual(['6000', '5000', '4000BV', '3000BV', '2000BV', '1000BV', '0']);
    expect(events('B')).toEqual(['6000', '5000T', '4000T', '3000T', '2000T', '1000', '0']);
    expect(events('C')).toEqual(['6000', '5000T', '4000T', '3000BV', '2000BV', '1000BV', '0']);
    expect(events('D')).toEqual(['6000', '5000T', '4000T', '3000TBV', '2000TBV', '1000', '0BV']);
  });

  it('keep the first player and rerolls of their side: A, B green/yellow; C, D red/black', () => {
    const plain = (track: readonly { first: Seat; reroll: boolean }[]) =>
      track.map(({ first, reroll }) => ({ first, reroll }));
    expect(plain(ALTITUDE_TRACKS.A)).toEqual(plain(BASE_ALTITUDES));
    expect(plain(ALTITUDE_TRACKS.B)).toEqual(plain(BASE_ALTITUDES));
    expect(plain(ALTITUDE_TRACKS.C)).toEqual(plain(HARD_ALTITUDES));
    expect(plain(ALTITUDE_TRACKS.D)).toEqual(plain(HARD_ALTITUDES));
  });
});

describe('scenario ids', () => {
  it('number an airport and colour that appear more than once, in list order', () => {
    expect(
      scenarioIds([
        { airport: 'DUS', difficulty: 'red' },
        { airport: 'DUS', difficulty: 'yellow' },
        { airport: 'DUS', difficulty: 'red' },
      ]),
    ).toEqual(['dus-red1', 'dus-yellow', 'dus-red2']);
  });
});

describe('turbulence', () => {
  // Track B, round 2 (5000 ft): Turbulence; the co-pilot plays first there.
  const TURBULENT = { altitudes: ALTITUDE_TRACKS.B };

  it('rerolls the placing player’s remaining dice after each die they place', () => {
    const s = setupRound({
      pilot: [2, 2, 2, 2],
      copilot: [2, 2, 2, 2],
      scenario: TURBULENT,
      patch: { round: 2 },
    });
    const after = placeDie(s, 'copilot', intent('c1', 'axisCopilot'));
    expect(after.dice.copilot.map((d) => d.id)).toEqual(['c2', 'c3', 'c4']);
    expect(after.rngState).not.toBe(s.rngState);
    expect(weatherEvents(after)).toEqual([
      { type: 'weather', round: 2, seat: 'copilot', dice: after.dice.copilot },
    ]);
    // The partner's dice are not touched.
    expect(after.dice.pilot).toEqual(s.dice.pilot);
  });

  it('does nothing on a calm altitude', () => {
    const s = setupRound({ pilot: [2, 2, 2, 2], copilot: [2, 2, 2, 2], scenario: TURBULENT });
    const after = placeDie(s, 'pilot', intent('p1', 'axisPilot'));
    expect(after.dice.pilot.map((d) => d.value)).toEqual([2, 2, 2]);
    expect(weatherEvents(after)).toEqual([]);
  });
});

describe('bad visibility', () => {
  // Track A, round 3 (4000 ft): Bad Visibility; the pilot plays first there.
  const FOGGY = { altitudes: ALTITUDE_TRACKS.A };
  const foggyGame = () => createGame(testScenario(undefined, FOGGY), 7);

  it('rolls only 2 dice each and sets 2 aside', () => {
    const s = rollDice({ ...foggyGame(), round: 3 });
    expect(s.dice.pilot).toHaveLength(BAD_VISIBILITY_HAND);
    expect(s.dice.copilot).toHaveLength(BAD_VISIBILITY_HAND);
    expect(s.setAside).toEqual({ pilot: 2, copilot: 2 });
    // The partner sees four dice left, two of them set aside.
    expect(viewFor(s, 'copilot').partnerDiceLeft).toBe(4);
    expect(viewFor(s, 'copilot').setAside).toEqual({ pilot: 2, copilot: 2 });
  });

  it('brings in a freshly rolled set-aside die after each of the next two placements', () => {
    const s = setupRound({ pilot: [3, 5], copilot: [3, 5], scenario: FOGGY, patch: { round: 3 } });
    let next = placeDie(s, 'pilot', intent('p1', 'axisPilot'));
    // The die kept in hand is not rerolled; the new one is.
    expect(next.dice.pilot[0]).toEqual({ id: 'p2', value: 5 });
    expect(next.dice.pilot[1]!.id).toBe('r3-p3');
    expect(next.setAside.pilot).toBe(1);

    next = placeDie(next, 'copilot', intent('c1', 'axisCopilot'));
    next = placeDie(next, 'pilot', intent('p2', 'enginePilot'));
    expect(next.dice.pilot.map((d) => d.id)).toEqual(['r3-p3', 'r3-p4']);
    expect(next.setAside.pilot).toBe(0);

    // No dice left aside: the hand shrinks.
    next = placeDie(next, 'copilot', intent('c2', 'engineCopilot'));
    next = placeDie(next, 'pilot', intent('r3-p3', 'concentration1', 0));
    expect(next.dice.pilot.map((d) => d.id)).toEqual(['r3-p4']);
  });
});

describe('turbulence and bad visibility together', () => {
  // Track D, round 4 (3000 ft): both; the co-pilot plays first there.
  const STORM = { altitudes: ALTITUDE_TRACKS.D };

  it('rolls both dice in hand when a set-aside die comes in, then rerolls the last die', () => {
    const s = setupRound({ pilot: [3, 3], copilot: [3, 3], scenario: STORM, patch: { round: 4 } });
    let next = placeDie(s, 'copilot', intent('c1', 'axisCopilot'));
    expect(next.dice.copilot.map((d) => d.id)).toEqual(['c2', 'r4-c3']);
    const [event] = weatherEvents(next);
    expect(event).toMatchObject({ seat: 'copilot', dice: next.dice.copilot });

    next = placeDie(next, 'pilot', intent('p1', 'axisPilot'));
    next = placeDie(next, 'copilot', intent(next.dice.copilot[0]!.id, 'engineCopilot'));
    expect(next.setAside.copilot).toBe(0);
    // With nothing left aside, each placement still rerolls the remaining die.
    next = placeDie(next, 'pilot', intent(next.dice.pilot[0]!.id, 'enginePilot'));
    const before = weatherEvents(next).length;
    const [first, last] = next.dice.copilot;
    next = placeDie(next, 'copilot', intent(first!.id, 'radioCopilot1'));
    expect(next.phase).toBe('placing');
    expect(weatherEvents(next)).toHaveLength(before + 1);
    expect(next.dice.copilot.map((d) => d.id)).toEqual([last!.id]);
  });
});

describe('total trust', () => {
  const TRUST: Partial<Scenario> = {
    modules: ['total-trust'],
    totalTrust: [1, 0, 1, 0, 0, 0, 0],
  };

  it('never applies to the first round', () => {
    expect(createGame(testScenario(undefined, TRUST), 1).autoRoll).toBe(false);
  });

  it('skips the next strategy discussion when the round ends on a Total Trust space', () => {
    const round = (approachIndex: number) =>
      play(
        setupRound({
          pilot: [2, 2, 3, 3],
          copilot: [2, 2, 3, 3],
          scenario: TRUST,
          patch: { approachIndex },
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
    expect(round(2)).toMatchObject({ phase: 'strategy', round: 2, autoRoll: true });
    expect(round(1)).toMatchObject({ phase: 'strategy', round: 2, autoRoll: false });
    expect(viewFor(round(2), 'pilot').autoRoll).toBe(true);
  });
});

describe('alarms', () => {
  const ALARMS: Partial<Scenario> = { modules: ['alarms'] };
  const withAlarms = (active: AlarmId[], extra: Partial<GameState> = {}) => ({
    alarms: { active, faceDown: ALARM_IDS.filter((id) => !active.includes(id)) },
    ...extra,
  });

  it('start with every token face down, and flip one per symbol on the space', () => {
    const quiet = createGame(testScenario(undefined, ALARMS), 1);
    expect(quiet.alarms).toEqual({ active: [], faceDown: [...ALARM_IDS] });

    const loud = createGame(
      testScenario(undefined, { ...ALARMS, alarms: [2, 0, 0, 0, 0, 0, 0] }),
      1,
    );
    expect(loud.alarms!.active).toHaveLength(2);
    expect(loud.alarms!.faceDown).toHaveLength(4);
    expect(loud.log.filter((e) => e.type === 'alarm')).toHaveLength(2);
    // The random flip comes from the game's RNG: same seed, same tokens.
    expect(
      createGame(testScenario(undefined, { ...ALARMS, alarms: [2, 0, 0, 0, 0, 0, 0] }), 1).alarms,
    ).toEqual(loud.alarms);
  });

  it('flip nothing once every token is face up or removed', () => {
    const s = createGame(testScenario(undefined, { ...ALARMS, alarms: [9, 0, 0, 0, 0, 0, 0] }), 1);
    expect(s.alarms!.active).toHaveLength(6);
    expect(s.alarms!.faceDown).toEqual([]);
  });

  it('block their Action: no die can go there while the token is face up', () => {
    const s = setupRound({
      pilot: [4, 2, 3, 3],
      copilot: [1, 2, 3, 3],
      scenario: ALARMS,
      patch: withAlarms(['flaps', 'concentration']),
    });
    expect(reason(s, 'pilot', intent('p3', 'concentration1'))).toBe('alarm-blocked');
    const copilotTurn = { ...s, currentSeat: 'copilot' as const };
    expect(reason(copilotTurn, 'copilot', intent('c1', 'flaps1'))).toBe('alarm-blocked');
    // A token that is not face up cannot be cleared.
    expect(reason(s, 'pilot', intent('p2', 'alarmBrakes'))).toBe('wrong-seat');
    expect(reason(copilotTurn, 'copilot', intent('c2', 'alarmBrakes'))).toBe('alarm-not-active');
  });

  it('clear with a die of the colour and number on the token, coffee included', () => {
    const s = setupRound({
      pilot: [3, 2, 3, 3],
      copilot: [2, 2, 3, 3],
      scenario: ALARMS,
      patch: withAlarms(['flaps'], { coffee: 1 }),
    });
    // The Flaps alarm takes a blue (pilot) 4: the co-pilot cannot clear it.
    expect(reason({ ...s, currentSeat: 'copilot' }, 'copilot', intent('c1', 'alarmFlaps', 2))).toBe(
      'wrong-seat',
    );
    expect(reason(s, 'pilot', intent('p1', 'alarmFlaps'))).toBe('value-not-allowed');
    const cleared = placeDie(s, 'pilot', intent('p1', 'alarmFlaps', 1));
    expect(cleared.alarms!.active).toEqual([]);
    expect(cleared.dice.pilot.map((d) => d.id)).toEqual(['p2', 'p3', 'p4']);
    expect(reason(cleared, 'copilot', intent('c1', 'flaps1'))).toBe('ok');
  });

  it('take a 1 of either colour on Concentration', () => {
    const s = setupRound({
      pilot: [1, 2, 3, 3],
      copilot: [1, 2, 3, 3],
      scenario: ALARMS,
      patch: withAlarms(['concentration']),
    });
    expect(reason(s, 'pilot', intent('p1', 'alarmConcentration'))).toBe('ok');
    expect(
      reason({ ...s, currentSeat: 'copilot' }, 'copilot', intent('c1', 'alarmConcentration')),
    ).toBe('ok');
  });

  it('count as placing on an Action for Turbulence', () => {
    // Round 2 on track B is turbulent, and the co-pilot plays first: an orange 2 clears Brakes.
    const s = setupRound({
      pilot: [2, 2, 2, 2],
      copilot: [2, 2, 2, 2],
      scenario: { ...ALARMS, altitudes: ALTITUDE_TRACKS.B },
      patch: withAlarms(['brakes'], { round: 2 }),
    });
    const after = placeDie(s, 'copilot', intent('c1', 'alarmBrakes'));
    expect(after.alarms!.active).toEqual([]);
    expect(weatherEvents(after)).toHaveLength(1);
  });

  it('never prevent a landing', () => {
    const s = createGame(testScenario(undefined, ALARMS), 1);
    expect(
      checkLanding({
        ...s,
        ...withAlarms([...ALARM_IDS]),
        gear: [true, true, true],
        flaps: [true, true, true, true],
        speed: 4,
        brakes: 3,
      }),
    ).toEqual([]);
  });
});

describe('belly landing', () => {
  const BELLY: Partial<Scenario> = { modules: ['belly-landing', 'alarms'] };

  it('covers the landing gear and lands without it', () => {
    const s = setupRound({ pilot: [1, 2, 3, 3], copilot: [2, 2, 3, 3], scenario: BELLY });
    expect(reason(s, 'pilot', intent('p1', 'gear1'))).toBe('unknown-slot');
    expect(landingConditions(s.scenario)).not.toContain('landing-gear');
    expect(checkLanding({ ...s, flaps: [true, true, true, true], speed: 4, brakes: 3 })).toEqual(
      [],
    );
  });

  it('uses only the Flaps, Co-Pilot Radio and Concentration alarms', () => {
    const s = createGame(testScenario(undefined, BELLY), 1);
    expect(s.alarms!.faceDown).toEqual(['flaps', 'radioCopilot', 'concentration']);
  });
});
