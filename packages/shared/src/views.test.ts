import { describe, expect, it } from 'vitest';
import { playRandomGame } from './random-play';
import { canPlaceDie, otherSeat, placeDie, rollDice } from './rules';
import { YUL } from './scenarios';
import { SLOT_IDS } from './slots';
import { createGame } from './state';
import { SEATS } from './types';
import { canPlaceInView, viewFor } from './views';

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

describe('canPlaceInView', () => {
  it('agrees with canPlaceDie on every move, for both seats, across random games', () => {
    // Plain comparisons: over 100,000 `expect` calls would be far too slow.
    const reason = (c: { ok: boolean; reason?: string }) => (c.ok ? 'ok' : c.reason);
    const mismatches: string[] = [];
    let checked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      playRandomGame(seed, YUL, (state) => {
        for (const seat of SEATS) {
          const view = viewFor(state, seat);
          const ids = [...state.dice[seat], ...state.dice[otherSeat(seat)]].map((d) => d.id);
          for (const dieId of ids) {
            for (const slot of SLOT_IDS) {
              for (let coffeeDelta = -3; coffeeDelta <= 3; coffeeDelta++) {
                const intent = { dieId, slot, coffeeDelta };
                const fromView = reason(canPlaceInView(view, intent));
                const fromState = reason(canPlaceDie(state, seat, intent));
                if (fromView !== fromState) {
                  mismatches.push(
                    `${seed} ${seat} ${JSON.stringify(intent)}: ${fromView} vs ${fromState}`,
                  );
                }
                checked++;
              }
            }
          }
        }
      });
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
    expect(checked).toBeGreaterThan(100_000);
    // Thousands of moves: slow when the whole suite runs in parallel.
  }, 60_000);
});
