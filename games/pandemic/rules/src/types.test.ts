import { describe, expect, it } from 'vitest';
import { CITIES, COLORS } from './cities';
import {
  CUBES_PER_COLOR,
  EVENT_IDS,
  INFECTION_RATES,
  MAX_OUTBREAKS,
  ROLE_IDS,
  SEATS,
  SETUP_INFECTIONS,
} from './types';

describe('constants', () => {
  it('match the box', () => {
    expect(CUBES_PER_COLOR * COLORS.length).toBe(96);
    expect(EVENT_IDS).toHaveLength(5);
    expect(ROLE_IDS).toHaveLength(7);
    expect(SEATS).toHaveLength(4);
    expect(MAX_OUTBREAKS).toBe(8);
  });

  it('start with 9 infected cities and 18 cubes', () => {
    const cities = SETUP_INFECTIONS.length * 3;
    const cubes = SETUP_INFECTIONS.reduce((sum, n) => sum + n * 3, 0);
    expect(cities).toBe(9);
    expect(cubes).toBe(18);
  });

  it('have an infection rate for every marker position', () => {
    expect(INFECTION_RATES).toEqual([2, 2, 2, 3, 3, 4, 4]);
  });

  it('leave a player deck of 48 city cards and 5 events plus the epidemics', () => {
    expect(CITIES.length + EVENT_IDS.length).toBe(53);
  });
});
