import { describe, expect, it } from 'vitest';
import { cubesOnBoard } from './actions';
import { COLORS } from './cities';
import { infectCity } from './outbreak';
import { addCubes, blankGame } from './test-utils';
import { CUBES_PER_COLOR } from './types';

describe('infectCity', () => {
  it('adds one cube to a city', () => {
    const game = blankGame();
    infectCity(game, 'atlanta', 1);
    expect(game.cubes.atlanta.blue).toBe(1);
    expect(game.supply.blue).toBe(23);
    expect(game.outbreaks).toBe(0);
  });

  it('uses the color of the city', () => {
    const game = blankGame();
    infectCity(game, 'tokyo', 1);
    expect(game.cubes.tokyo.red).toBe(1);
  });

  it('places nothing for an eradicated disease', () => {
    const game = blankGame();
    game.cures.blue = 'eradicated';
    infectCity(game, 'atlanta', 1);
    infectCity(game, 'atlanta', 3);
    expect(game.cubes.atlanta.blue).toBe(0);
    expect(game.outbreaks).toBe(0);
  });

  it('does not place a fourth cube: it outbreaks into the connected cities', () => {
    const game = blankGame();
    addCubes(game, 'atlanta', 'blue', 3);
    infectCity(game, 'atlanta', 1);
    expect(game.cubes.atlanta.blue).toBe(3);
    expect(game.outbreaks).toBe(1);
    for (const next of ['chicago', 'washington', 'miami'] as const) {
      expect(game.cubes[next].blue).toBe(1);
    }
    expect(cubesOnBoard(game, 'blue') + game.supply.blue).toBe(CUBES_PER_COLOR);
  });

  it('puts cubes of the outbreak color on cities of any color', () => {
    const game = blankGame();
    addCubes(game, 'atlanta', 'blue', 3);
    infectCity(game, 'atlanta', 1);
    expect(game.cubes.miami).toEqual({ blue: 1, yellow: 0, black: 0, red: 0 });
  });

  it('chains: a neighbor with three cubes outbreaks after the first one is done', () => {
    const game = blankGame();
    addCubes(game, 'algiers', 'black', 3);
    addCubes(game, 'cairo', 'black', 3);
    infectCity(game, 'algiers', 1);
    expect(game.outbreaks).toBe(2);
    // Algiers: Madrid, Paris, Istanbul, Cairo(chain). Cairo: Istanbul, Baghdad, Riyadh, Khartoum.
    expect(game.cubes.madrid.black).toBe(1);
    expect(game.cubes.paris.black).toBe(1);
    expect(game.cubes.istanbul.black).toBe(2);
    expect(game.cubes.baghdad.black).toBe(1);
    expect(game.cubes.khartoum.black).toBe(1);
    expect(game.cubes.algiers.black).toBe(3);
    expect(game.cubes.cairo.black).toBe(3);
  });

  it('outbreaks once per city in a loop of three cities', () => {
    const game = blankGame();
    for (const c of ['washington', 'montreal', 'new-york'] as const) addCubes(game, c, 'blue', 3);
    infectCity(game, 'washington', 1);
    expect(game.outbreaks).toBe(3);
    for (const c of ['washington', 'montreal', 'new-york'] as const) {
      expect(game.cubes[c].blue).toBe(3);
    }
    expect(game.cubes.atlanta.blue).toBe(1);
    expect(game.cubes.chicago.blue).toBe(1);
    expect(game.cubes.london.blue).toBe(1);
    expect(game.cubes.madrid.blue).toBe(1);
    expect(game.cubes.miami.blue).toBe(1);
  });

  it('tops a city up to three for an epidemic, with an outbreak if it already had cubes', () => {
    const game = blankGame();
    infectCity(game, 'tokyo', 3);
    expect(game.cubes.tokyo.red).toBe(3);
    expect(game.outbreaks).toBe(0);
    const other = blankGame();
    addCubes(other, 'tokyo', 'red', 1);
    infectCity(other, 'tokyo', 3);
    expect(other.cubes.tokyo.red).toBe(3);
    expect(other.outbreaks).toBe(1);
    expect(other.cubes.seoul.red).toBe(1);
  });

  it('loses at the eighth outbreak', () => {
    const game = blankGame();
    game.outbreaks = 7;
    addCubes(game, 'atlanta', 'blue', 3);
    infectCity(game, 'atlanta', 1);
    expect(game.status).toBe('lost');
    expect(game.lossReason).toBe('outbreaks');
  });

  it('loses when the supply cannot cover the cubes needed', () => {
    const game = blankGame();
    game.supply.red = 2;
    infectCity(game, 'tokyo', 3);
    expect(game.status).toBe('lost');
    expect(game.lossReason).toBe('cubes');
  });

  it('loses when an outbreak runs out of cubes', () => {
    const game = blankGame();
    addCubes(game, 'atlanta', 'blue', 3);
    game.supply.blue = 2;
    infectCity(game, 'atlanta', 1);
    expect(game.lossReason).toBe('cubes');
  });

  it('keeps the cubes through any chain', () => {
    const game = blankGame();
    for (const c of ['algiers', 'cairo', 'istanbul', 'baghdad', 'madrid'] as const) {
      addCubes(game, c, 'black', 3);
    }
    infectCity(game, 'algiers', 1);
    for (const color of COLORS) {
      expect(cubesOnBoard(game, color) + game.supply[color]).toBe(CUBES_PER_COLOR);
    }
  });
});
