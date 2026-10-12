import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cubesOnBoard } from './actions';
import { CITIES, COLORS } from './cities';
import { applyMove, checkMove, type PandemicMove } from './moves';
import { agentMove } from './random-play';
import { createGame } from './setup';
import {
  CUBES_PER_COLOR,
  EVENT_IDS,
  ROLE_IDS,
  SEATS,
  type GameState,
  type RoleId,
  type SeatId,
} from './types';

const CARDS = CITIES.length + EVENT_IDS.length;

/** Every card of the player deck that is not an epidemic, wherever it is. */
function cardsInGame(game: GameState): number {
  const held = SEATS.reduce((sum, seat) => sum + (game.hands[seat]?.length ?? 0), 0);
  const deck = game.playerDeck.filter((card) => card.kind !== 'epidemic').length;
  return held + deck + game.playerDiscard.length + (game.contingency === null ? 0 : 1);
}

describe('random roles', () => {
  it('deals each seat a different role, the same for the same seed', () => {
    for (const players of [2, 3, 4]) {
      const game = createGame({ seats: SEATS.slice(0, players), epidemics: 4, seed: 11 });
      const roles = game.seats.map((seat) => game.roles[seat]);
      expect(new Set(roles).size).toBe(players);
      expect(roles.every((role) => ROLE_IDS.includes(role as RoleId))).toBe(true);
      expect(createGame({ seats: SEATS.slice(0, players), epidemics: 4, seed: 11 }).roles).toEqual(
        game.roles,
      );
    }
  });

  it('deals every role across seeds', () => {
    const seen = new Set<RoleId>();
    for (let seed = 1; seed <= 60; seed++) {
      const game = createGame({ seats: ['p1', 'p2'], epidemics: 4, seed });
      for (const seat of game.seats) seen.add(game.roles[seat] as RoleId);
    }
    expect([...seen].sort()).toEqual([...ROLE_IDS].sort());
  });

  it('keeps the cubes and the cards whole through whole games with any roles', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 4 }),
        fc.integer({ min: 0, max: 100000 }),
        fc.shuffledSubarray([...ROLE_IDS], { minLength: 4, maxLength: 7 }),
        fc.array(fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }), {
          minLength: 300,
          maxLength: 300,
        }),
        (players, seed, roles, randoms) => {
          let game = createGame({ seats: SEATS.slice(0, players), epidemics: 4, seed });
          // The roles are chosen by the property, so every role plays in some run.
          game.seats.forEach((seat, i) => (game.roles[seat] = roles[i] as RoleId));
          let n = 0;
          const random = () => randoms[n++ % randoms.length] as number;
          for (let step = 0; step < 300 && game.status === 'playing'; step++) {
            const { by: who, move: next } = agentMove(game, random);
            const move = next as PandemicMove;
            const by = who as SeatId;
            expect(checkMove(game, by as SeatId, move).ok).toBe(true);
            game = applyMove(game, by as SeatId, move);
            for (const color of COLORS) {
              expect(cubesOnBoard(game, color) + game.supply[color]).toBe(CUBES_PER_COLOR);
            }
            expect(cardsInGame(game)).toBe(CARDS);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
