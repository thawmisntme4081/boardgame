import { describe, expect, it } from 'vitest';
import { CITIES, COLORS } from './cities';
import { createGame, pileSizes, shuffle } from './setup';
import { CUBES_PER_COLOR, EVENT_IDS, HAND_SIZES, SEATS, type GameState } from './types';

const make = (players: number, epidemics = 4, seed = 1): GameState =>
  createGame({ seats: SEATS.slice(0, players), epidemics, seed });

const onBoard = (game: GameState, color: (typeof COLORS)[number]) =>
  Object.values(game.cubes).reduce((sum, cubes) => sum + cubes[color], 0);

describe('shuffle', () => {
  it('keeps the same items and is repeatable', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6], 7);
    const b = shuffle([1, 2, 3, 4, 5, 6], 7);
    expect(a).toEqual(b);
    expect([...a.items].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('pileSizes', () => {
  it('splits as equally as possible, larger piles first', () => {
    expect(pileSizes(53, 4)).toEqual([14, 13, 13, 13]);
    expect(pileSizes(45, 6)).toEqual([8, 8, 8, 7, 7, 7]);
    expect(pileSizes(48, 4)).toEqual([12, 12, 12, 12]);
  });
});

describe('createGame', () => {
  for (const players of [2, 3, 4]) {
    for (const epidemics of [4, 5, 6]) {
      describe(`${players} players, ${epidemics} epidemics`, () => {
        const game = make(players, epidemics);

        it('seats everyone at Atlanta with a station there and no other', () => {
          expect([...game.seats].sort()).toEqual(SEATS.slice(0, players));
          for (const seat of game.seats) expect(game.pawns[seat]).toBe('atlanta');
          expect(game.stations).toEqual(['atlanta']);
        });

        it('deals the right hands, with no epidemic in them', () => {
          for (const seat of game.seats) {
            expect(game.hands[seat]).toHaveLength(HAND_SIZES[players] as number);
          }
          expect(JSON.stringify(game.hands)).not.toContain('epidemic');
        });

        it('keeps every card: hands + deck = 48 cities, 5 events, the epidemics', () => {
          const dealt = game.seats.reduce((n, seat) => n + (game.hands[seat]?.length ?? 0), 0);
          expect(dealt + game.playerDeck.length).toBe(CITIES.length + EVENT_IDS.length + epidemics);
          expect(game.playerDeck.filter((card) => card.kind === 'epidemic')).toHaveLength(
            epidemics,
          );
        });

        it('puts exactly one epidemic in each pile', () => {
          const sizes = pileSizes(game.playerDeck.length - epidemics, epidemics);
          let at = 0;
          for (const size of sizes) {
            const pile = game.playerDeck.slice(at, at + size + 1);
            expect(pile.filter((card) => card.kind === 'epidemic')).toHaveLength(1);
            at += size + 1;
          }
        });

        it('infects 9 cities with 18 cubes and discards their cards', () => {
          expect(game.infectionDiscard).toHaveLength(9);
          expect(game.infectionDeck).toHaveLength(39);
          const counts = game.infectionDiscard.map((city) =>
            Object.values(game.cubes[city]).reduce((a, b) => a + b, 0),
          );
          expect(counts).toEqual([3, 3, 3, 2, 2, 2, 1, 1, 1]);
        });

        it('keeps the cubes: board + supply = 24 per color', () => {
          for (const color of COLORS) {
            expect(onBoard(game, color) + game.supply[color]).toBe(CUBES_PER_COLOR);
          }
        });

        it('starts the first seat in the order with 4 actions', () => {
          expect(game.turn).toMatchObject({ seat: game.seats[0], actionsLeft: 4, step: 'actions' });
          expect(game.status).toBe('playing');
          expect(game.outbreaks).toBe(0);
          expect(game.infectionRate).toBe(0);
        });
      });
    }
  }

  it('is repeatable and differs by seed', () => {
    expect(make(3, 5, 42)).toEqual(make(3, 5, 42));
    expect(make(3, 5, 42)).not.toEqual(make(3, 5, 43));
  });

  it('gives a fixed game for a fixed seed', () => {
    const game = make(2, 4, 1);
    expect(game.seats).toEqual(['p1', 'p2']);
    expect(game.hands.p1).toEqual([
      { kind: 'city', city: 'seoul' },
      { kind: 'event', event: 'one-quiet-night' },
      { kind: 'city', city: 'st-petersburg' },
      { kind: 'city', city: 'moscow' },
    ]);
    expect(game.infectionDiscard.slice(0, 3)).toEqual(['san-francisco', 'chennai', 'algiers']);
  });

  it('shuffles the turn order across seeds', () => {
    const firsts = new Set(Array.from({ length: 30 }, (_, seed) => make(4, 4, seed).seats[0]));
    expect(firsts.size).toBeGreaterThan(1);
  });

  it('refuses bad options', () => {
    expect(() => createGame({ seats: ['p1'], epidemics: 4, seed: 1 })).toThrow();
    expect(() => createGame({ seats: ['p1', 'p1'], epidemics: 4, seed: 1 })).toThrow();
    expect(() => createGame({ seats: ['p1', 'p2'], epidemics: 3, seed: 1 })).toThrow();
  });
});
