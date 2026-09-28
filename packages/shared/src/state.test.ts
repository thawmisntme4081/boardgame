import { describe, expect, it } from 'vitest';
import { RuleError, rollDice } from './rules';
import { YUL } from './scenarios';
import { createGame } from './state';

describe('createGame', () => {
  it('sets up the basic game', () => {
    const s = createGame(YUL, 1);
    expect(s).toMatchObject({
      phase: 'strategy',
      round: 1,
      currentSeat: 'pilot',
      axis: 0,
      approachIndex: 0,
      aeroBlue: 4,
      aeroOrange: 8,
      brakes: 0,
      coffee: 0,
      gear: [false, false, false],
      flaps: [false, false, false, false],
      speed: null,
      rngSeed: 1,
      log: [],
    });
    expect(s.dice).toEqual({ pilot: [], copilot: [] });
    expect(s.approachPlanes).toEqual(YUL.approach);
    expect(s.approachPlanes).not.toBe(YUL.approach);
  });

  it('takes the 6000 ft reroll token into the supply', () => {
    expect(createGame(YUL, 1).rerolls).toBe(1);
  });
});

describe('rollDice', () => {
  it('rolls 4 dice per seat and starts placing with the altitude arrow seat', () => {
    const s = rollDice(createGame(YUL, 1));
    expect(s.phase).toBe('placing');
    expect(s.currentSeat).toBe('pilot');
    expect(s.dice.pilot).toHaveLength(4);
    expect(s.dice.copilot).toHaveLength(4);
    for (const die of [...s.dice.pilot, ...s.dice.copilot]) {
      expect(die.value).toBeGreaterThanOrEqual(1);
      expect(die.value).toBeLessThanOrEqual(6);
    }
    expect(new Set([...s.dice.pilot, ...s.dice.copilot].map((d) => d.id)).size).toBe(8);
  });

  it('is deterministic for a seed', () => {
    expect(rollDice(createGame(YUL, 5)).dice).toEqual(rollDice(createGame(YUL, 5)).dice);
    expect(rollDice(createGame(YUL, 5)).dice).not.toEqual(rollDice(createGame(YUL, 6)).dice);
  });

  it('logs the roll', () => {
    const s = rollDice(createGame(YUL, 1));
    expect(s.log).toEqual([{ type: 'roll', round: 1, dice: s.dice }]);
  });

  it('does not mutate its input', () => {
    const game = createGame(YUL, 1);
    const before = structuredClone(game);
    rollDice(game);
    expect(game).toEqual(before);
  });

  it('only rolls in the strategy phase', () => {
    const s = rollDice(createGame(YUL, 1));
    expect(() => rollDice(s)).toThrow(RuleError);
  });
});
