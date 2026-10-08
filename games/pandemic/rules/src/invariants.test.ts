import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyAction, cubesOnBoard } from './actions';
import { COLORS } from './cities';
import { legalActions } from './legal';
import { applyShare, checkShare } from './share';
import { createGame } from './setup';
import { CUBES_PER_COLOR, SEATS, type GameState } from './types';

/** Starts the next player's turn (the draw and infect steps do not exist yet). */
function nextTurn(state: GameState): GameState {
  const s = structuredClone(state);
  const at = s.seats.indexOf(s.turn.seat);
  s.turn = {
    ...s.turn,
    seat: s.seats[(at + 1) % s.seats.length]!,
    actionsLeft: 4,
    step: 'actions',
  };
  return s;
}

describe('cube conservation', () => {
  it('keeps cubes on the map plus the supply at 24 per color through random actions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 4 }),
        fc.integer({ min: 0, max: 1000 }),
        fc.array(fc.nat(1000), { minLength: 1, maxLength: 120 }),
        (players, seed, picks) => {
          let game = createGame({ seats: SEATS.slice(0, players), epidemics: 4, seed });
          for (const pick of picks) {
            if (game.status !== 'playing') break;
            if (game.turn.step !== 'actions') game = nextTurn(game);
            const seat = game.turn.seat;
            const actions = legalActions(game, seat);
            game = applyAction(game, seat, actions[pick % actions.length]!);
            for (const color of COLORS) {
              expect(cubesOnBoard(game, color) + game.supply[color]).toBe(CUBES_PER_COLOR);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('keeps every card in the game when sharing', () => {
    const game = createGame({ seats: ['p1', 'p2'], epidemics: 4, seed: 5 });
    game.turn.seat = 'p1';
    game.pawns.p2 = game.pawns.p1 as never;
    const count = (g: GameState) =>
      (g.hands.p1?.length ?? 0) + (g.hands.p2?.length ?? 0) + g.playerDiscard.length;
    const before = count(game);
    const here = game.pawns.p1 as string;
    game.hands.p1!.push({ kind: 'city', city: here as never });
    const move = { type: 'share-offer', direction: 'give', with: 'p2' } as const;
    expect(checkShare(game, 'p1', move).ok).toBe(true);
    const done = applyShare(applyShare(game, 'p1', move), 'p2', { type: 'share-accept' });
    expect(count(done)).toBe(before + 1);
  });
});
