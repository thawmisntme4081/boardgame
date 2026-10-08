// Helpers for tests: a seeded game with an empty board, so each test sets up only what it needs.
import { CITIES, type CityId, type Color } from './cities';
import { createGame } from './setup';
import { CUBES_PER_COLOR, type GameState, type HandCard, type SeatId } from './types';

export const city = (id: CityId): HandCard => ({ kind: 'city', city: id });

/** A 2-player game (p1 to move, in Atlanta) with no cubes, no hands and a full supply. */
export function blankGame(players: 2 | 3 | 4 = 2): GameState {
  const game = createGame({
    seats: (['p1', 'p2', 'p3', 'p4'] as const).slice(0, players),
    epidemics: 4,
    seed: 1,
  });
  game.seats = [...game.seats].sort();
  game.turn.seat = 'p1';
  for (const c of CITIES) game.cubes[c.id] = { blue: 0, yellow: 0, black: 0, red: 0 };
  game.supply = { blue: 0, yellow: 0, black: 0, red: 0 };
  for (const color of ['blue', 'yellow', 'black', 'red'] as Color[])
    game.supply[color] = CUBES_PER_COLOR;
  for (const seat of game.seats) {
    game.hands[seat] = [];
    game.pawns[seat] = 'atlanta';
  }
  game.infectionDiscard = [];
  game.playerDiscard = [];
  return game;
}

/** Puts cubes on the map and takes them out of the supply. */
export function addCubes(game: GameState, at: CityId, color: Color, count: number): void {
  game.cubes[at][color] += count;
  game.supply[color] -= count;
}

export const give = (game: GameState, seat: SeatId, ...cards: HandCard[]): void => {
  (game.hands[seat] as HandCard[]).push(...cards);
};
