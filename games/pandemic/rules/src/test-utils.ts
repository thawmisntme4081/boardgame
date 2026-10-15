// Helpers for tests: a seeded game with an empty board, so each test sets up only what it needs.
import { CITIES, type CityId, type Color } from './cities';
import { applyPreflight } from './preflight';
import { createGame } from './setup';
import {
  CUBES_PER_COLOR,
  ROLE_IDS,
  type GameState,
  type RoleId,
  type SetupState,
  type HandCard,
  type PandemicState,
  type SeatId,
} from './types';

/**
 * The game of a table that has every seat taken (tests set it up that way): the "before the
 * game" step is gone through (in choose mode each seat takes the first free role).
 */
export function dealt(state: PandemicState): GameState {
  if (state.status === 'waiting') throw new Error('the game is still waiting for players');
  let table: PandemicState = state;
  while (table.status === 'setup') {
    const setup: SetupState = table;
    const seat = setup.seats.find((s) => !setup.confirmed.includes(s)) as SeatId;
    if (!setup.picks[seat]) {
      const free = ROLE_IDS.find((role) => !Object.values(setup.picks).includes(role)) as RoleId;
      table = applyPreflight(setup, seat, { type: 'pick-role', role: free });
    } else {
      table = applyPreflight(setup, seat, { type: 'confirm' });
    }
  }
  return table as GameState;
}

export const city = (id: CityId): HandCard => ({ kind: 'city', city: id });

/**
 * Roles that change no rule the older tests look at (no cube is blocked, no pawn moves for
 * another): the same four in any game, so tests that are not about roles stay the same.
 */
export function neutralRoles(game: GameState): GameState {
  const plain = ['researcher', 'scientist', 'contingency-planner', 'researcher'] as const;
  game.seats.forEach((seat, i) => (game.roles[seat] = plain[i]));
  return game;
}

/** A 2-player game (p1 to move, in Atlanta) with no cubes, no hands and a full supply. */
export function blankGame(players: 2 | 3 | 4 = 2): GameState {
  const game = createGame({
    seats: (['p1', 'p2', 'p3', 'p4'] as const).slice(0, players),
    epidemics: 4,
    seed: 1,
  });
  game.seats = [...game.seats].sort();
  neutralRoles(game);
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
