import type { CityId, Color } from '@pandemic/rules';

export const MAP_WIDTH = 950;
export const MAP_HEIGHT = 690;

const CITY_POINTS: Record<CityId, readonly [x: number, y: number]> = {
  'san-francisco': [59, 237.5],
  chicago: [147, 212.5],
  montreal: [214.5, 210],
  'new-york': [254, 205.5],
  atlanta: [171, 264],
  washington: [224.5, 259.5],
  london: [397.5, 178.5],
  madrid: [400.5, 250.5],
  essen: [465.5, 164.5],
  paris: [448.5, 210.5],
  milan: [494, 197],
  'st-petersburg': [541.5, 150.5],
  'los-angeles': [88.5, 307.5],
  'mexico-city': [136.5, 329.5],
  miami: [211.5, 325],
  bogota: [209.5, 389],
  lima: [193, 457.5],
  santiago: [205.5, 541.5],
  'buenos-aires': [267, 526.5],
  'sao-paulo': [307, 474],
  lagos: [441, 376.5],
  khartoum: [529, 364],
  kinshasa: [484.5, 425],
  johannesburg: [524, 494.5],
  moscow: [579, 197],
  tehran: [626, 229.5],
  istanbul: [524.5, 237],
  baghdad: [574, 273],
  algiers: [463, 282.5],
  cairo: [515, 296.5],
  riyadh: [582, 335.5],
  karachi: [640, 295.5],
  delhi: [690.5, 276],
  kolkata: [738.5, 293],
  mumbai: [667.5, 346.5],
  chennai: [688.5, 388.5],
  beijing: [778, 214],
  seoul: [839.5, 210.5],
  tokyo: [889, 232],
  shanghai: [782.5, 262],
  osaka: [883.5, 256.5],
  taipei: [814.5, 310.5],
  'hong-kong': [780, 323],
  bangkok: [751.5, 349.5],
  'ho-chi-minh-city': [779, 386],
  manila: [845, 400.5],
  jakarta: [754.5, 442.5],
  sydney: [898.5, 537.5],
};

/** A city's position on the map, in map units (the 950 × 690 frame). */
export const cityPoint = (id: CityId): { x: number; y: number } => {
  const [x, y] = CITY_POINTS[id];
  return { x, y };
};

/** The vial slots at the bottom of the map: the center of each slot and its top edge. */
export const CURE_SLOTS: Record<Color, { x: number; top: number }> = {
  yellow: { x: 239.75, top: 637.5 },
  red: { x: 285.75, top: 637.5 },
  blue: { x: 331.5, top: 637.5 },
  black: { x: 373.5, top: 637.5 },
};

/** The diamonds of the outbreak track, from 0 outbreaks to the skull (8): marker centers. */
export const OUTBREAK_SLOTS: readonly { x: number; y: number }[] = [
  { x: 53.75, y: 388.25 },
  { x: 88.75, y: 419.25 },
  { x: 53.75, y: 446.75 },
  { x: 88.75, y: 476.75 },
  { x: 53.75, y: 505.75 },
  { x: 88.75, y: 533.5 },
  { x: 53.75, y: 560 },
  { x: 88.75, y: 588.5 },
  { x: 53.75, y: 614.5 },
];

export const OUTBREAK_SLOT_SIZE = 32;

export const INFECTION_SLOTS: readonly { x: number; y: number }[] = [
  617.5, 651.25, 685.25, 719.25, 753.25, 787.25, 821.25,
].map((x) => ({ x, y: 155.5 }));

export const INFECTION_SLOT_SIZE = 31;

export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The two green frames at the top: the infection deck and its discard pile. */
export const INFECTION_DECK_FRAME: Frame = { x: 572.8, y: 32, width: 139.5, height: 100 };
export const INFECTION_DISCARD_FRAME: Frame = { x: 734, y: 32, width: 139.5, height: 100 };

/** The place for the event card stored on the Contingency Planner's role card, at the top left. */
export const CONTINGENCY_FRAME: Frame = { x: 18, y: 18, width: 120, height: 167 };

/**
 * The bottom edge the board's lower row shares: the cure slots, the supply panel, the player deck
 * and the player discard pile all end here.
 */
export const BOARD_BOTTOM = 678.5;

/** The player deck and its discard pile (the same size), at the bottom, right of the supply panel. */
export const PLAYER_DECK_FRAME: Frame = {
  x: 587.5,
  y: BOARD_BOTTOM - 143,
  width: 102.5,
  height: 143,
};
export const PLAYER_DISCARD_FRAME: Frame = {
  x: 700,
  y: BOARD_BOTTOM - 143,
  width: 102.5,
  height: 143,
};

/** Where each disease's cubes-left counter is: the center of its cube icon (a 2 × 2 block left of the player deck). */
export const SUPPLY_SPOTS: Record<Color, { x: number; y: number }> = {
  yellow: { x: 482.5, y: 624 },
  red: { x: 537.5, y: 624 },
  blue: { x: 482.5, y: 654 },
  black: { x: 537.5, y: 654 },
};

/** The size of a counter's cube icon. */
export const SUPPLY_ICON_SIZE = 20;

/** Where the research stations-left counter is: the center of its icon, left of the cube counters. */
export const STATION_SUPPLY_SPOT = { x: 425.5, y: 654 };
