import { describe, expect, it } from 'vitest';
import { placeDie, rollDice } from './rules';
import { YUL } from './scenarios';
import { createGame } from './state';
import { viewFor } from './views';

describe('viewFor', () => {
  const game = rollDice(createGame(YUL, 7));

  it('shows your own dice and only a count of the partner dice', () => {
    const pilot = viewFor(game, 'pilot');
    expect(pilot.seat).toBe('pilot');
    expect(pilot.myDice).toEqual(game.dice.pilot);
    expect(pilot.partnerDiceLeft).toBe(4);

    const copilot = viewFor(game, 'copilot');
    expect(copilot.myDice).toEqual(game.dice.copilot);
    expect(copilot.partnerDiceLeft).toBe(4);
  });

  it('never contains the partner die ids, the RNG or the log', () => {
    const json = JSON.stringify(viewFor(game, 'pilot'));
    for (const die of game.dice.copilot) expect(json).not.toContain(die.id);
    expect(json).not.toContain('rngSeed');
    expect(json).not.toContain('rngState');
    expect(json).not.toContain('"log"');
    expect(Object.keys(viewFor(game, 'copilot'))).not.toContain('dice');
  });

  it('shows placed dice, which are public', () => {
    const die = game.dice.pilot[0]!;
    const after = placeDie(game, 'pilot', { dieId: die.id, slot: 'axisPilot', coffeeDelta: 0 });
    const copilot = viewFor(after, 'copilot');
    expect(copilot.placed.axisPilot).toEqual({ seat: 'pilot', dieId: die.id, value: die.value });
    expect(copilot.partnerDiceLeft).toBe(3);
    expect(copilot.currentSeat).toBe('copilot');
  });

  it('includes the public board state', () => {
    const view = viewFor(game, 'pilot');
    expect(view).toMatchObject({
      phase: 'placing',
      round: 1,
      altitude: 6000,
      finalRound: false,
      axis: 0,
      approachIndex: 0,
      approachPlanes: YUL.approach,
      aeroBlue: 4,
      aeroOrange: 8,
      brakes: 0,
      coffee: 0,
      rerolls: 1,
      speed: null,
    });
  });

  it('does not share references with the state', () => {
    const view = viewFor(game, 'pilot');
    view.myDice.pop();
    view.approachPlanes[2] = 99;
    view.gear[0] = true;
    expect(game.dice.pilot).toHaveLength(4);
    expect(game.approachPlanes).toEqual(YUL.approach);
    expect(game.gear[0]).toBe(false);
  });
});
