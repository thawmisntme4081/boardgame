import type { AltitudeSpace, Difficulty, Scenario } from './types';

/** Green/yellow side of the altitude track: first player alternates, rerolls at 6000 and 2000. */
export const BASE_ALTITUDES: AltitudeSpace[] = [
  { altitude: 6000, first: 'pilot', reroll: true },
  { altitude: 5000, first: 'copilot', reroll: false },
  { altitude: 4000, first: 'pilot', reroll: false },
  { altitude: 3000, first: 'copilot', reroll: false },
  { altitude: 2000, first: 'pilot', reroll: true },
  { altitude: 1000, first: 'copilot', reroll: false },
  { altitude: 0, first: 'pilot', reroll: false },
];

/**
 * Red/black side of the altitude track, for Elite and Heroic scenarios.
 * PLACEHOLDER: not in the Flight Log; assumed like the green side with one reroll (6000).
 */
export const HARD_ALTITUDES: AltitudeSpace[] = BASE_ALTITUDES.map((space) => ({
  ...space,
  reroll: space.altitude === 6000,
}));

export const DIFFICULTIES: readonly Difficulty[] = ['green', 'yellow', 'red', 'black'];

export const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  green: 'Routine landing',
  yellow: 'Exceptional conditions',
  red: 'Elite pilots only',
  black: 'Heroic landing',
};

export const AIRPORT_NAMES: Record<string, string> = {
  YUL: 'Montréal-Trudeau',
  LHR: 'Heathrow',
  HND: 'Haneda',
  OSL: 'Gardermoen',
  ATL: 'Hartsfield-Jackson',
  PRG: 'Václav Havel',
  TGU: 'Toncontín',
  GIG: 'Galeão',
  KEF: 'Keflavík',
  KUL: 'Kuala Lumpur',
  PBH: 'Paro',
};

export const YUL: Scenario = {
  id: 'yul',
  airport: 'YUL',
  name: 'YUL Montréal-Trudeau',
  difficulty: 'green',
  altitudes: BASE_ALTITUDES,
  approach: [0, 0, 1, 2, 1, 3, 2],
  modules: [],
  abilities: 0,
};

// Axis positions for turns (positive = toward the pilot, i.e. a left turn).
const LEFT = [1, 2];
const BEAR_LEFT = [0, 1, 2];
const RIGHT = [-2, -1];
const BEAR_RIGHT = [-2, -1, 0];
const STEADY = [-1, 0, 1];
const LEVEL = [0];

type Entry = Omit<Scenario, 'id' | 'name' | 'altitudes' | 'placeholder'>;

/**
 * The Flight Log scenarios (modules and ability counts from the cards). The approach tracks
 * (planes, traffic icons, turns) are printed only on the tiles: these are PLACEHOLDERS
 * shaped after each card's story until they are read off the real tracks.
 */
const ENTRIES: Entry[] = [
  // Green: routine landing.
  {
    airport: 'LHR',
    difficulty: 'green',
    approach: [0, 0, 0, 1, 2, 3, 3],
    modules: [],
    abilities: 0,
  },
  {
    airport: 'HND',
    difficulty: 'green',
    approach: [0, 1, 1, 2, 1, 1, 2],
    turns: [null, null, BEAR_LEFT, BEAR_LEFT, BEAR_LEFT, null, null],
    modules: [],
    abilities: 0,
  },
  {
    airport: 'OSL',
    difficulty: 'green',
    approach: [0, 1, 1, 1, 2, 1, 2],
    modules: ['kerosene'],
    abilities: 0,
  },
  {
    airport: 'ATL',
    difficulty: 'green',
    approach: [0, 1, 0, 2, 1, 1, 2],
    traffic: [2, 0, 1, 0, 1, 0, 0],
    modules: ['intern'],
    abilities: 0,
  },
  {
    airport: 'PRG',
    difficulty: 'green',
    approach: [0, 1, 2, 1, 2, 1, 1, 2],
    modules: ['kerosene'],
    abilities: 2,
  },
  // Yellow: exceptional conditions.
  {
    airport: 'LHR',
    difficulty: 'yellow',
    approach: [0, 2, 2, 1, 1, 1, 2],
    traffic: [0, 1, 0, 0, 1, 0, 0],
    modules: ['intern'],
    abilities: 0,
  },
  {
    airport: 'TGU',
    difficulty: 'yellow',
    approach: [0, 1, 1, 2, 1, 1],
    turns: [null, null, null, LEFT, LEFT, null],
    modules: ['kerosene'],
    abilities: 2,
  },
  {
    airport: 'GIG',
    difficulty: 'yellow',
    approach: [0, 0, 1, 1, 2, 1, 1, 2, 1],
    turns: [null, null, BEAR_RIGHT, BEAR_RIGHT, BEAR_RIGHT, null, null, null, null],
    modules: ['wind'],
    abilities: 1,
  },
  {
    airport: 'KEF',
    difficulty: 'yellow',
    approach: [0, 1, 1, 1, 2, 1, 2],
    modules: ['ice-brakes'],
    abilities: 1,
  },
  {
    airport: 'PRG',
    difficulty: 'yellow',
    approach: [0, 1, 2, 1, 2, 1, 1, 2],
    modules: ['kerosene-leak'],
    abilities: 2,
  },
  {
    airport: 'KUL',
    difficulty: 'yellow',
    approach: [0, 1, 1, 1, 1, 2, 2],
    turns: [null, STEADY, STEADY, STEADY, STEADY, null, null],
    modules: ['kerosene'],
    abilities: 1,
  },
  {
    airport: 'ATL',
    difficulty: 'yellow',
    approach: [0, 1, 1, 2, 1, 2, 2],
    traffic: [2, 1, 1, 1, 0, 0, 0],
    modules: ['kerosene-leak'],
    abilities: 1,
  },
  // Red: elite pilots only.
  {
    airport: 'PBH',
    difficulty: 'red',
    approach: [0, 1, 1, 1, 1, 2, 1],
    traffic: [1, 0, 0, 0, 0, 0, 0],
    turns: [null, LEFT, [0, 1], [-1, 0], RIGHT, null, null],
    modules: ['kerosene', 'real-time'],
    abilities: 2,
  },
  {
    airport: 'HND',
    difficulty: 'red',
    approach: [0, 2, 1, 2, 1, 2, 2],
    traffic: [1, 0, 1, 0, 0, 0, 0],
    turns: [null, STEADY, STEADY, LEVEL, STEADY, null, null],
    modules: ['intern'],
    abilities: 1,
  },
  {
    airport: 'GIG',
    difficulty: 'red',
    approach: [0, 1, 1, 2, 1, 1, 2, 1, 1],
    turns: [null, STEADY, STEADY, STEADY, null, null, null, null, null],
    modules: ['wind', 'kerosene-leak'],
    abilities: 2,
  },
  {
    airport: 'OSL',
    difficulty: 'red',
    approach: [0, 1, 1, 2, 1, 2, 2],
    modules: ['kerosene-leak', 'ice-brakes'],
    abilities: 2,
  },
  {
    airport: 'TGU',
    difficulty: 'red',
    approach: [0, 1, 1, 2, 1, 2],
    turns: [null, null, null, LEFT, LEFT, null],
    modules: ['kerosene', 'wind'],
    abilities: 2,
  },
  // Black: heroic landing.
  {
    airport: 'KEF',
    difficulty: 'black',
    approach: [0, 1, 2, 1, 2, 1, 2, 1],
    modules: ['wind', 'ice-brakes'],
    abilities: 2,
  },
  {
    airport: 'KUL',
    difficulty: 'black',
    approach: [0, 1, 1, 2, 1, 2, 2],
    traffic: [1, 0, 1, 0, 1, 0, 0],
    turns: [null, STEADY, STEADY, LEVEL, STEADY, STEADY, null],
    modules: ['kerosene', 'real-time'],
    abilities: 2,
  },
  {
    airport: 'PBH',
    difficulty: 'black',
    approach: [0, 1, 1, 2, 1, 2, 2],
    traffic: [1, 1, 0, 0, 0, 0, 0],
    turns: [null, LEFT, [0, 1], [-1, 0], RIGHT, STEADY, null],
    modules: ['kerosene', 'real-time'],
    abilities: 2,
  },
];

const HARD: readonly Difficulty[] = ['red', 'black'];

/** Every scenario, in Flight Log order (green, yellow, red, black). */
export const SCENARIO_LIST: readonly Scenario[] = [
  YUL,
  ...ENTRIES.map((entry): Scenario => ({
    ...entry,
    id: `${entry.airport.toLowerCase()}-${entry.difficulty}`,
    name: `${entry.airport} ${AIRPORT_NAMES[entry.airport]}`,
    altitudes: HARD.includes(entry.difficulty) ? HARD_ALTITUDES : BASE_ALTITUDES,
    placeholder: true,
  })),
];

export const SCENARIOS: Record<string, Scenario> = Object.fromEntries(
  SCENARIO_LIST.map((scenario) => [scenario.id, scenario]),
);
