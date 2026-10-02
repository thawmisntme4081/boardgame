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

/** Red/black side (Elite and Heroic scenarios): the same, with a reroll only at 6000 (confirmed Oct 1, 2026). */
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
  BUD: 'Ferenc Liszt',
  OSL: 'Gardermoen',
  BLQ: 'Guglielmo Marconi',
  ATL: 'Hartsfield-Jackson',
  PRG: 'Václav Havel',
  TER: 'Lajes, Azores',
  TGU: 'Toncontín',
  GIG: 'Galeão',
  KEF: 'Keflavík',
  KUL: 'Kuala Lumpur',
  CDG: 'Paris - Charles de Gaulle',
  DUS: 'Düsseldorf',
  LGA: 'LaGuardia',
  NZIR: 'Ice Runway',
  PBH: 'Paro',
};

// Axis positions for turns, left to right -2 -1 0 1 2 (negative = toward the pilot, a left turn).
const BEAR_LEFT = [-2, -1, 0] as const;
const FULL_LEFT = [-2] as const;
const LEFT = [-2, -1] as const;
const EASE_LEFT = [-1, 0] as const;
const STEADY = [-1, 0, 1] as const;
const LEVEL = [0] as const;
const EASE_RIGHT = [0, 1] as const;
const RIGHT = [1, 2] as const;
const BEAR_RIGHT = [0, 1, 2] as const;
const FULL_RIGHT = [2] as const;

/** The id (`<airport>-<color>`, e.g. `lhr-yellow`), name and altitude track follow from these. */
type Entry = Omit<Scenario, 'id' | 'name' | 'altitudes'>;

/**
 * The Flight Log scenarios: modules, ability counts and colors from the cards; approach
 * tracks (planes, traffic icons, turns) from the printed tiles.
 */
const ENTRIES: Entry[] = [
  // Green: routine landing.
  {
    airport: 'YUL',
    difficulty: 'green',
    approach: [0, 0, 1, 2, 1, 3, 2],
    modules: [],
    abilities: 0,
  },
  {
    airport: 'LHR',
    difficulty: 'green',
    approach: [0, 1, 1, 2, 2, 2],
    traffic: [1, 0, 1, 0, 1, 0],
    modules: [],
    abilities: 0,
  },
  {
    airport: 'HND',
    difficulty: 'green',
    approach: [0, 1, 1, 2, 1, 0, 2, 1],
    traffic: [2, 0, 0, 0, 0, 0, 0, 0],
    turns: [null, null, EASE_LEFT, null, LEFT, BEAR_LEFT, null, null],
    modules: [],
    abilities: 0,
  },
  {
    airport: 'BUD',
    difficulty: 'green',
    approach: [0, 1, 1, 2, 1, 2],
    traffic: [3, 0, 0, 1, 0, 0],
    turns: [null, null, EASE_RIGHT, null, LEFT, null],
    modules: ['wind'],
    abilities: 0,
  },
  {
    airport: 'OSL',
    difficulty: 'green',
    approach: [0, 0, 1, 0, 1, 1, 1, 0],
    traffic: [2, 0, 0, 1, 0, 0, 0, 0],
    modules: ['kerosene'],
    abilities: 0,
  },
  {
    airport: 'BLQ',
    difficulty: 'green',
    approach: [1, 1, 1, 1, 2, 2],
    traffic: [3, 0, 1, 0, 0, 0],
    turns: [null, EASE_LEFT, null, EASE_RIGHT, null, null],
    modules: ['kerosene-leak'],
    abilities: 0,
  },
  {
    airport: 'ATL',
    difficulty: 'green',
    approach: [0, 0, 0, 0, 1, 2, 1, 2],
    traffic: [4, 0, 1, 0, 1, 1, 0, 0],
    modules: ['intern'],
    abilities: 0,
  },
  {
    airport: 'PRG',
    difficulty: 'green',
    approach: [0, 0, 1, 1, 0, 1, 1, 1],
    traffic: [1, 0, 1, 0, 0, 1, 0, 0],
    turns: [null, EASE_LEFT, null, RIGHT, null, null, null, null],
    modules: ['kerosene'],
    abilities: 2,
  },
  // Yellow: exceptional conditions.
  {
    airport: 'TER',
    difficulty: 'yellow',
    approach: [0, 0, 0, 0, 1, 1, 1],
    traffic: [3, 0, 0, 0, 0, 0, 0],
    turns: [LEFT, BEAR_RIGHT, LEFT, RIGHT, LEFT, RIGHT, null],
    modules: ['ice-brakes', 'engines-out'],
    abilities: 2,
  },
  {
    airport: 'LHR',
    difficulty: 'yellow',
    approach: [1, 1, 1, 2, 1, 2],
    traffic: [2, 0, 1, 1, 1, 0],
    modules: ['intern'],
    abilities: 0,
  },
  {
    airport: 'TGU',
    difficulty: 'yellow',
    approach: [0, 1, 1, 1, 1],
    traffic: [3, 0, 0, 0, 0],
    turns: [null, LEFT, EASE_LEFT, LEFT, null],
    modules: ['kerosene'],
    abilities: 2,
  },
  {
    airport: 'GIG',
    difficulty: 'yellow',
    approach: [0, 0, 2, 1, 2, 3, 1],
    traffic: [2, 0, 0, 1, 1, 0, 0],
    modules: ['wind'],
    abilities: 1,
  },
  {
    airport: 'KEF',
    difficulty: 'yellow',
    approach: [0, 0, 1, 1, 1, 0],
    traffic: [2, 0, 1, 0, 1, 0],
    modules: ['ice-brakes'],
    abilities: 1,
  },
  {
    airport: 'KUL',
    difficulty: 'yellow',
    approach: [0, 0, 1, 1, 0, 1, 1, 1],
    traffic: [2, 0, 0, 1, 0, 0, 0, 0],
    turns: [null, RIGHT, null, EASE_RIGHT, RIGHT, null, RIGHT, null],
    modules: ['kerosene'],
    abilities: 1,
  },
  {
    airport: 'PRG',
    difficulty: 'yellow',
    approach: [0, 0, 1, 3, 0, 3, 2, 3],
    traffic: [0, 0, 0, 1, 0, 1, 0, 0],
    modules: ['kerosene-leak'],
    abilities: 2,
  },
  {
    airport: 'ATL',
    difficulty: 'yellow',
    approach: [0, 1, 0, 2, 2, 1, 3, 1],
    traffic: [1, 1, 0, 2, 1, 0, 0, 0],
    turns: [null, null, STEADY, null, null, null, RIGHT, null],
    modules: ['kerosene-leak'],
    abilities: 1,
  },
  {
    airport: 'CDG',
    difficulty: 'yellow',
    approach: [0, 1, 0, 0, 2, 2, 1, 2],
    traffic: [3, 0, 0, 1, 1, 1, 0, 0],
    modules: ['wind', 'intern'],
    abilities: 0,
  },
  {
    airport: 'DUS',
    difficulty: 'yellow',
    approach: [0, 1, 1, 2, 1, 2, 1, 1],
    traffic: [3, 0, 0, 0, 0, 2, 0, 0],
    turns: [null, null, null, STEADY, null, STEADY, null, null],
    modules: ['kerosene-leak'],
    abilities: 2,
  },
  {
    airport: 'LGA',
    difficulty: 'yellow',
    approach: [0, 0, 0, 1, 2, 1, 1],
    traffic: [1, 0, 1, 0, 1, 0, 0],
    turns: [null, BEAR_RIGHT, null, BEAR_LEFT, null, null, null],
    modules: ['ice-brakes'],
    abilities: 2,
  },
  // Red: elite pilots only.
  {
    airport: 'NZIR',
    difficulty: 'red',
    approach: [0, 0, 0, 1, 1, 1, 0, 0],
    traffic: [3, 0, 0, 0, 0, 0, 0, 0],
    turns: [null, LEFT, null, null, EASE_RIGHT, null, null, null],
    modules: ['wind-reversed', 'ice-brakes'],
    abilities: 1,
  },
  {
    airport: 'PBH',
    difficulty: 'red',
    approach: [0, 1, 1, 1, 1, 1],
    traffic: [3, 0, 0, 1, 0, 0],
    turns: [null, null, LEFT, BEAR_LEFT, RIGHT, null],
    modules: ['kerosene', 'real-time'],
    abilities: 2,
  },
  {
    airport: 'CDG',
    difficulty: 'red',
    approach: [1, 0, 0, 0, 1, 1, 2, 1],
    traffic: [2, 0, 0, 1, 0, 1, 0, 0],
    turns: [null, null, null, LEFT, null, RIGHT, null, null],
    modules: ['kerosene', 'wind'],
    abilities: 0,
  },
  {
    airport: 'GIG',
    difficulty: 'red',
    approach: [0, 1, 2, 2, 1, 1, 2],
    traffic: [3, 0, 1, 0, 1, 0, 0],
    modules: ['wind', 'kerosene-leak'],
    abilities: 2,
  },
  {
    airport: 'OSL',
    difficulty: 'red',
    approach: [1, 0, 1, 0, 0, 1, 0, 0],
    traffic: [3, 0, 1, 0, 1, 0, 1, 0],
    modules: ['kerosene-leak', 'ice-brakes'],
    abilities: 2,
  },
  {
    airport: 'HND',
    difficulty: 'red',
    approach: [1, 0, 1, 1, 1, 2, 1, 2],
    traffic: [3, 0, 0, 1, 1, 1, 0, 0],
    turns: [null, EASE_LEFT, null, LEFT, EASE_LEFT, null, LEFT, null],
    modules: ['intern'],
    abilities: 1,
  },
  {
    airport: 'PRG',
    difficulty: 'red',
    approach: [1, 1, 1, 1, 0, 1, 1, 1],
    traffic: [1, 0, 1, 0, 0, 1, 0, 0],
    turns: [null, EASE_LEFT, null, RIGHT, null, null, null, null],
    modules: ['kerosene', 'wind'],
    abilities: 1,
  },
  {
    airport: 'YUL',
    difficulty: 'red',
    approach: [0, 0, 1, 2, 1, 3, 2],
    modules: ['intern', 'ice-brakes'],
    abilities: 1,
  },
  {
    airport: 'LHR',
    difficulty: 'red',
    approach: [1, 1, 1, 2, 2, 2],
    traffic: [1, 0, 1, 0, 1, 0],
    modules: ['altitude-5000'],
    abilities: 1,
  },
  {
    airport: 'TGU',
    difficulty: 'red',
    approach: [0, 1, 1, 1, 2],
    traffic: [3, 0, 2, 0, 0],
    turns: [null, LEFT, EASE_LEFT, LEFT, null],
    modules: ['kerosene', 'wind'],
    abilities: 2,
  },
  {
    airport: 'BUD',
    difficulty: 'red',
    approach: [1, 1, 1, 1, 1, 1],
    traffic: [4, 0, 1, 1, 0, 0],
    turns: [null, null, EASE_RIGHT, RIGHT, LEFT, null],
    modules: ['wind', 'altitude-5000'],
    abilities: 2,
  },
  {
    airport: 'BLQ',
    difficulty: 'red',
    approach: [1, 1, 2, 1, 1, 2],
    traffic: [3, 0, 0, 0, 0, 0],
    turns: [null, LEVEL, null, LEVEL, null, null],
    modules: ['kerosene'],
    abilities: 1,
  },
  // Black: heroic landing.
  {
    airport: 'KEF',
    difficulty: 'black',
    approach: [0, 0, 2, 1, 1, 0],
    traffic: [2, 0, 1, 0, 0, 0],
    turns: [null, BEAR_LEFT, null, BEAR_RIGHT, STEADY, null],
    modules: ['wind', 'ice-brakes'],
    abilities: 2,
  },
  {
    airport: 'TER',
    difficulty: 'black',
    approach: [0, 0, 0, 1, 1, 1, 1],
    traffic: [3, 0, 0, 0, 0, 0, 0],
    turns: [LEFT, RIGHT, LEFT, RIGHT, LEFT, RIGHT, null],
    modules: ['ice-brakes', 'engines-out'],
    abilities: 1,
  },
  {
    airport: 'NZIR',
    difficulty: 'black',
    approach: [0, 1, 0, 0, 0, 0, 0, 0],
    traffic: [2, 0, 0, 0, 0, 0, 0, 0],
    turns: [null, null, EASE_LEFT, null, RIGHT, null, EASE_LEFT, null],
    modules: ['wind-reversed', 'ice-brakes', 'kerosene', 'intern'],
    abilities: 0,
  },
  {
    airport: 'LGA',
    difficulty: 'black',
    approach: [0, 0, 0, 0, 1, 1, 0],
    traffic: [0, 0, 1, 0, 1, 0, 0],
    turns: [BEAR_RIGHT, null, RIGHT, null, LEFT, null, null],
    modules: ['kerosene', 'ice-brakes'],
    abilities: 1,
  },
  {
    airport: 'KUL',
    difficulty: 'black',
    approach: [0, 0, 1, 0, 1, 1, 1, 1],
    traffic: [3, 0, 1, 0, 0, 1, 0, 0],
    turns: [null, EASE_RIGHT, null, FULL_LEFT, EASE_LEFT, EASE_RIGHT, RIGHT, null],
    modules: ['kerosene', 'real-time'],
    abilities: 2,
  },
  {
    airport: 'PBH',
    difficulty: 'black',
    approach: [1, 0, 1, 1, 1, 1],
    traffic: [3, 0, 1, 1, 1, 0],
    turns: [null, null, LEFT, LEFT, FULL_RIGHT, null],
    modules: ['kerosene', 'real-time'],
    abilities: 2,
  },
  {
    airport: 'DUS',
    difficulty: 'black',
    approach: [1, 0, 0, 1, 2, 1, 3, 2],
    traffic: [2, 0, 1, 2, 0, 1, 0, 0],
    turns: [null, LEVEL, null, LEFT, null, RIGHT, null, null],
    modules: ['kerosene-leak', 'real-time'],
    abilities: 1,
  },
  {
    airport: 'ATL',
    difficulty: 'black',
    approach: [0, 0, 0, 0, 1, 2, 1, 2],
    traffic: [4, 0, 1, 0, 1, 1, 0, 0],
    modules: ['kerosene'],
    abilities: 1,
  },
  {
    airport: 'HND',
    difficulty: 'black',
    approach: [1, 0, 1, 1, 1, 2, 1, 1],
    traffic: [3, 0, 0, 1, 1, 1, 0, 0],
    turns: [null, EASE_LEFT, null, LEFT, EASE_LEFT, null, LEFT, null],
    modules: ['intern', 'kerosene'],
    abilities: 1,
  },
];

const HARD: readonly Difficulty[] = ['red', 'black'];

export const SCENARIO_LIST: readonly Scenario[] = ENTRIES.map((entry): Scenario => ({
  ...entry,
  id: `${entry.airport.toLowerCase()}-${entry.difficulty}`,
  name: `${entry.airport} ${AIRPORT_NAMES[entry.airport]}`,
  altitudes: HARD.includes(entry.difficulty) ? HARD_ALTITUDES : BASE_ALTITUDES,
}));

export const SCENARIOS: Record<string, Scenario> = Object.fromEntries(
  SCENARIO_LIST.map((scenario) => [scenario.id, scenario]),
);

export const YUL: Scenario = SCENARIOS['yul-green']!;
