import type {
  AltitudeEvents,
  AltitudeSpace,
  AltitudeTrackId,
  Difficulty,
  ModuleId,
  Scenario,
} from './types';

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

const TURBULENCE: AltitudeEvents = { turbulence: true };
const BAD_VISIBILITY: AltitudeEvents = { badVisibility: true };
const STORM: AltitudeEvents = { turbulence: true, badVisibility: true };

/** A track with weather events on some altitudes (by altitude in feet). */
const withEvents = (
  track: AltitudeSpace[],
  events: Record<number, AltitudeEvents>,
): AltitudeSpace[] => track.map((space) => ({ ...space, ...events[space.altitude] }));

/**
 * Turbulence replacement altitude tracks (confirmed by the user Oct 2, 2026): A and B follow
 * the green/yellow side, C and D the red/black side, with their weather events.
 */
export const ALTITUDE_TRACKS: Record<AltitudeTrackId, AltitudeSpace[]> = {
  A: withEvents(BASE_ALTITUDES, {
    4000: BAD_VISIBILITY,
    3000: BAD_VISIBILITY,
    2000: BAD_VISIBILITY,
    1000: BAD_VISIBILITY,
  }),
  B: withEvents(BASE_ALTITUDES, {
    5000: TURBULENCE,
    4000: TURBULENCE,
    3000: TURBULENCE,
    2000: TURBULENCE,
  }),
  C: withEvents(HARD_ALTITUDES, {
    5000: TURBULENCE,
    4000: TURBULENCE,
    3000: BAD_VISIBILITY,
    2000: BAD_VISIBILITY,
    1000: BAD_VISIBILITY,
  }),
  D: withEvents(HARD_ALTITUDES, {
    5000: TURBULENCE,
    4000: TURBULENCE,
    3000: STORM,
    2000: STORM,
    0: BAD_VISIBILITY,
  }),
};

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
  // Turbulence destinations (names from the rulebook).
  CPT: 'Cape Town',
  SYD: 'Kingsford Smith',
  PEK: 'Beijing Capital',
  KBP: 'Boryspil',
  WAW: 'Warsaw Chopin',
  SXM: 'Princess Juliana',
  MAD: 'Madrid–Barajas',
};

/**
 * A turn: the axis positions allowed when the plane flies out of the space, from `from` to
 * `to` (left to right -2 -1 0 1 2; negative = toward the pilot, a left turn).
 * `axis(1)` is [1], `axis(-2, 0)` is [-2, -1, 0].
 */
const axis = (from: number, to = from): readonly number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** The id (`<airport>-<color>`, e.g. `lhr-yellow`), name and altitude track follow from these. */
/** Modules switched on by their data instead of being listed: an `alarms` or `totalTrust` array. */
type DataModule = 'alarms' | 'total-trust';

type Entry = Omit<Scenario, 'id' | 'name' | 'altitudes' | 'modules'> & {
  /** Without Alarms and Total Trust: their symbol arrays turn them on (see `entryModules`). */
  modules: Exclude<ModuleId, DataModule>[];
};

/** The entry's modules, plus Alarms / Total Trust when it has their symbols. */
const entryModules = (entry: Entry): ModuleId[] => [
  ...entry.modules,
  ...(entry.alarms ? (['alarms'] as const) : []),
  ...(entry.totalTrust ? (['total-trust'] as const) : []),
];

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
    turns: [null, null, axis(-1, 0), null, axis(-2, -1), axis(-2, 0), null, null],
    modules: [],
    abilities: 0,
  },
  {
    airport: 'BUD',
    difficulty: 'green',
    approach: [0, 1, 1, 2, 1, 2],
    traffic: [3, 0, 0, 1, 0, 0],
    turns: [null, null, axis(0, 1), null, axis(-2, -1), null],
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
    turns: [null, axis(-1, 0), null, axis(0, 1), null, null],
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
    turns: [null, axis(-1, 0), null, axis(1, 2), null, null, null, null],
    modules: ['kerosene'],
    abilities: 2,
  },
  {
    airport: 'CPT',
    difficulty: 'green',
    altitudeTrack: 'B',
    approach: [0, 1, 1, 1, 0, 1, 1],
    traffic: [2, 0, 0, 0, 0, 0, 0],
    turns: [null, null, axis(-2, 0), null, axis(-2, 0), null, null],
    modules: ['kerosene'],
    abilities: 1,
  },
  {
    airport: 'SYD',
    difficulty: 'green',
    approach: [0, 0, 0, 1, 1, 0, 1, 1],
    traffic: [3, 0, 0, 0, 0, 0, 0, 0],
    turns: [null, null, axis(1, 2), null, null, axis(1, 2), null, null],
    alarms: [1, 1, 1, 0, 1, 1, 1, 0],
    modules: [],
    abilities: 1,
  },
  {
    airport: 'PEK',
    difficulty: 'green',
    altitudeTrack: 'A',
    approach: [0, 1, 1, 2, 2, 2],
    traffic: [3, 0, 0, 0, 0, 0],
    turns: [null, axis(-2, 0), null, axis(0, 2), null, null],
    modules: [],
    abilities: 1,
  },
  // Yellow: exceptional conditions.
  {
    airport: 'TER',
    difficulty: 'yellow',
    approach: [0, 0, 0, 0, 1, 1, 1],
    traffic: [3, 0, 0, 0, 0, 0, 0],
    turns: [axis(-2, -1), axis(0, 2), axis(-2, -1), axis(1, 2), axis(-2, -1), axis(1, 2), null],
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
    turns: [null, axis(-2, -1), axis(-1, 0), axis(-2, -1), null],
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
    turns: [null, axis(1, 2), null, axis(0, 1), axis(1, 2), null, axis(1, 2), null],
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
    turns: [null, null, axis(-1, 1), null, null, null, axis(1, 2), null],
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
    turns: [null, null, null, axis(-1, 1), null, axis(-1, 1), null, null],
    modules: ['kerosene-leak'],
    abilities: 2,
  },
  {
    airport: 'LGA',
    difficulty: 'yellow',
    approach: [0, 0, 0, 1, 2, 1, 1],
    traffic: [1, 0, 1, 0, 1, 0, 0],
    turns: [null, axis(0, 2), null, axis(-2, 0), null, null, null],
    modules: ['ice-brakes'],
    abilities: 2,
  },
  {
    airport: 'SXM',
    difficulty: 'yellow',
    altitudeTrack: 'B',
    approach: [0, 1, 1, 2, 2],
    traffic: [3, 0, 1, 1, 0],
    turns: [axis(-2, -1), null, axis(-2, -1), null, null],
    modules: ['altitude-5000', 'intern'],
    abilities: 0,
  },
  {
    airport: 'DUS',
    difficulty: 'yellow',
    altitudeTrack: 'A',
    approach: [0, 1, 1, 2, 1, 2, 1, 1],
    traffic: [3, 0, 0, 0, 0, 2, 0, 0],
    turns: [null, null, null, axis(-1, 1), null, axis(-1, 1), null, null],
    modules: ['kerosene-leak'],
    abilities: 2,
  },
  {
    airport: 'WAW',
    difficulty: 'yellow',
    approach: [0, 0, 0, 1, 2],
    traffic: [2, 0, 1, 0, 0],
    turns: [axis(1, 2), axis(-2, 0), axis(0, 2), null, null],
    alarms: [0, 1, 1, 1, 0],
    modules: ['belly-landing', 'kerosene'],
    abilities: 1,
  },
  {
    airport: 'KBP',
    difficulty: 'yellow',
    approach: [0, 1, 0, 2, 1, 1, 1, 1],
    traffic: [3, 0, 1, 1, 0, 1, 0, 0],
    turns: [null, null, null, axis(0, 1), null, axis(-1, 0), null, null],
    totalTrust: [0, 0, 0, 0, 0, 1, 1, 1],
    modules: [],
    abilities: 2,
  },
  {
    airport: 'MAD',
    difficulty: 'yellow',
    approach: [0, 1, 0, 1, 1, 1, 2],
    traffic: [4, 0, 1, 0, 1, 0, 0],
    turns: [null, axis(0, 1), axis(-1, 0), null, axis(-2, -1), null, null],
    modules: ['altitude-5000', 'intern'],
    abilities: 1,
  },
  // Red: elite pilots only.
  {
    airport: 'NZIR',
    difficulty: 'red',
    approach: [0, 0, 0, 1, 1, 1, 0, 0],
    traffic: [3, 0, 0, 0, 0, 0, 0, 0],
    turns: [null, axis(-2, -1), null, null, axis(0, 1), null, null, null],
    modules: ['wind-reversed', 'ice-brakes'],
    abilities: 1,
  },
  {
    airport: 'PBH',
    difficulty: 'red',
    approach: [0, 1, 1, 1, 1, 1],
    traffic: [3, 0, 0, 1, 0, 0],
    turns: [null, null, axis(-2, -1), axis(-2, 0), axis(1, 2), null],
    modules: ['kerosene', 'real-time'],
    abilities: 2,
  },
  {
    airport: 'CDG',
    difficulty: 'red',
    approach: [1, 0, 0, 0, 1, 1, 2, 1],
    traffic: [2, 0, 0, 1, 0, 1, 0, 0],
    turns: [null, null, null, axis(-2, -1), null, axis(1, 2), null, null],
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
    turns: [null, axis(-1, 0), null, axis(-2, -1), axis(-1, 0), null, axis(-2, -1), null],
    modules: ['intern'],
    abilities: 1,
  },
  {
    airport: 'PRG',
    difficulty: 'red',
    approach: [1, 1, 1, 1, 0, 1, 1, 1],
    traffic: [1, 0, 1, 0, 0, 1, 0, 0],
    turns: [null, axis(-1, 0), null, axis(1, 2), null, null, null, null],
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
    turns: [null, axis(-2, -1), axis(-1, 0), axis(-2, -1), null],
    modules: ['kerosene', 'wind'],
    abilities: 2,
  },
  {
    airport: 'BUD',
    difficulty: 'red',
    approach: [1, 1, 1, 1, 1, 1],
    traffic: [4, 0, 1, 1, 0, 0],
    turns: [null, null, axis(0, 1), axis(1, 2), axis(-2, -1), null],
    modules: ['wind', 'altitude-5000'],
    abilities: 2,
  },
  {
    airport: 'BLQ',
    difficulty: 'red',
    approach: [1, 1, 2, 1, 1, 2],
    traffic: [3, 0, 0, 0, 0, 0],
    turns: [null, axis(0), null, axis(0), null, null],
    modules: ['kerosene'],
    abilities: 1,
  },
  {
    airport: 'SXM',
    difficulty: 'red',
    altitudeTrack: 'D',
    approach: [0, 0, 1, 1, 2],
    traffic: [3, 0, 0, 0, 0],
    turns: [axis(-2, -1), null, axis(-2), null, null],
    modules: ['altitude-5000', 'kerosene', 'intern'],
    abilities: 0,
  },
  {
    airport: 'SYD',
    difficulty: 'red',
    altitudeTrack: 'C',
    approach: [0, 0, 0, 1, 1, 1, 1, 1],
    traffic: [4, 0, 0, 0, 0, 0, 0, 0],
    turns: [null, axis(1, 2), null, axis(1, 2), null, axis(1, 2), null, null],
    alarms: [2, 1, 1, 0, 1, 1, 1, 0],
    modules: [],
    abilities: 2,
  },
  {
    airport: 'DUS',
    difficulty: 'red',
    altitudeTrack: 'C',
    approach: [1, 0, 0, 1, 2, 1, 3, 2],
    traffic: [2, 0, 1, 2, 0, 1, 0, 0],
    turns: [null, axis(1), null, axis(-2, -1), null, axis(1, 2), null, null],
    modules: ['real-time', 'kerosene-leak'],
    abilities: 1,
  },
  {
    airport: 'PEK',
    difficulty: 'red',
    altitudeTrack: 'C',
    approach: [1, 1, 1, 1, 2, 2],
    traffic: [3, 0, 1, 1, 0, 0],
    turns: [null, axis(-2, -1), axis(0, 1), axis(1, 2), null, null],
    modules: ['wind'],
    abilities: 1,
  },
  {
    airport: 'WAW',
    difficulty: 'red',
    approach: [0, 1, 1, 1, 1],
    traffic: [3, 0, 0, 0, 0],
    turns: [axis(1, 2), axis(-2, -1), axis(1), null, null],
    alarms: [0, 1, 1, 1, 0],
    modules: ['belly-landing', 'wind', 'kerosene'],
    abilities: 1,
  },
  // Black: heroic landing.
  {
    airport: 'KEF',
    difficulty: 'black',
    approach: [0, 0, 2, 1, 1, 0],
    traffic: [2, 0, 1, 0, 0, 0],
    turns: [null, axis(-2, 0), null, axis(0, 2), axis(-1, 1), null],
    modules: ['wind', 'ice-brakes'],
    abilities: 2,
  },
  {
    airport: 'TER',
    difficulty: 'black',
    approach: [0, 0, 0, 1, 1, 1, 1],
    traffic: [3, 0, 0, 0, 0, 0, 0],
    turns: [axis(-2, -1), axis(1, 2), axis(-2, -1), axis(1, 2), axis(-2, -1), axis(1, 2), null],
    modules: ['ice-brakes', 'engines-out'],
    abilities: 1,
  },
  {
    airport: 'NZIR',
    difficulty: 'black',
    approach: [0, 1, 0, 0, 0, 0, 0, 0],
    traffic: [2, 0, 0, 0, 0, 0, 0, 0],
    turns: [null, null, axis(-1, 0), null, axis(1, 2), null, axis(-1, 0), null],
    modules: ['wind-reversed', 'ice-brakes', 'kerosene', 'intern'],
    abilities: 0,
  },
  {
    airport: 'LGA',
    difficulty: 'black',
    approach: [0, 0, 0, 0, 1, 1, 0],
    traffic: [0, 0, 1, 0, 1, 0, 0],
    turns: [axis(0, 2), null, axis(1, 2), null, axis(-2, -1), null, null],
    modules: ['kerosene', 'ice-brakes'],
    abilities: 1,
  },
  {
    airport: 'KUL',
    difficulty: 'black',
    approach: [0, 0, 1, 0, 1, 1, 1, 1],
    traffic: [3, 0, 1, 0, 0, 1, 0, 0],
    turns: [null, axis(0, 1), null, axis(-2), axis(-1, 0), axis(0, 1), axis(1, 2), null],
    modules: ['kerosene', 'real-time'],
    abilities: 2,
  },
  {
    airport: 'PBH',
    difficulty: 'black',
    approach: [1, 0, 1, 1, 1, 1],
    traffic: [3, 0, 1, 1, 1, 0],
    turns: [null, null, axis(-2, -1), axis(-2, -1), axis(2), null],
    modules: ['kerosene', 'real-time'],
    abilities: 2,
  },
  {
    airport: 'DUS',
    difficulty: 'black',
    approach: [1, 0, 0, 1, 2, 1, 3, 2],
    traffic: [2, 0, 1, 2, 0, 1, 0, 0],
    turns: [null, axis(0), null, axis(-2, -1), null, axis(1, 2), null, null],
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
    turns: [null, axis(-1, 0), null, axis(-2, -1), axis(-1, 0), null, axis(-2, -1), null],
    modules: ['intern', 'kerosene'],
    abilities: 1,
  },
  {
    airport: 'CPT',
    difficulty: 'black',
    altitudeTrack: 'D',
    approach: [0, 0, 1, 1, 1, 1, 1],
    traffic: [3, 0, 0, 0, 0, 0, 0],
    turns: [axis(2), null, axis(-2, -1), null, axis(-2), null, null],
    alarms: [1, 2, 1, 1, 1, 1, 0],
    modules: ['wind', 'intern'],
    abilities: 0,
  },
  {
    airport: 'KBP',
    difficulty: 'black',
    approach: [0, 1, 1, 1, 1, 1, 1, 1],
    traffic: [2, 1, 0, 1, 0, 1, 0, 0],
    turns: [null, axis(-2, -1), null, axis(-2, -1), axis(-1), null, null, null],
    alarms: [2, 0, 1, 1, 1, 0, 1, 0],
    totalTrust: [0, 0, 0, 1, 1, 1, 1, 1],
    modules: [],
    abilities: 2,
  },
  {
    airport: 'MAD',
    difficulty: 'black',
    approach: [0, 0, 0, 1, 1, 1, 1],
    traffic: [3, 0, 1, 0, 0, 1, 0],
    turns: [axis(1, 2), null, axis(-1), null, axis(-2, -1), null, null],
    modules: ['altitude-5000', 'kerosene', 'real-time'],
    abilities: 1,
  },
];

const HARD: readonly Difficulty[] = ['red', 'black'];

const baseId = (entry: Pick<Scenario, 'airport' | 'difficulty'>) =>
  `${entry.airport.toLowerCase()}-${entry.difficulty}`;

/** `lhr-yellow`; when an airport and color appear more than once: `dus-red1`, `dus-red2`. */
export const scenarioIds = (
  entries: readonly Pick<Scenario, 'airport' | 'difficulty'>[],
): string[] => {
  const seen = new Map<string, number>();
  return entries.map((entry) => {
    const id = baseId(entry);
    const repeats = entries.filter((e) => baseId(e) === id).length;
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    return repeats > 1 ? `${id}${n}` : id;
  });
};

const ENTRY_IDS = scenarioIds(ENTRIES);

export const SCENARIO_LIST: readonly Scenario[] = ENTRIES.map((entry, i): Scenario => ({
  ...entry,
  modules: entryModules(entry),
  id: ENTRY_IDS[i]!,
  name: `${entry.airport} ${AIRPORT_NAMES[entry.airport]}`,
  altitudes: entry.altitudeTrack
    ? ALTITUDE_TRACKS[entry.altitudeTrack]
    : HARD.includes(entry.difficulty)
      ? HARD_ALTITUDES
      : BASE_ALTITUDES,
}));

export const SCENARIOS: Record<string, Scenario> = Object.fromEntries(
  SCENARIO_LIST.map((scenario) => [scenario.id, scenario]),
);

export const YUL: Scenario = SCENARIOS['yul-green']!;
