import type { CityId, Color } from '@pandemic/rules';

export const MAP_WIDTH = 950;
export const MAP_HEIGHT = 690;

const CITY_POINTS: Record<CityId, readonly [x: number, y: number]> = {
  'san-francisco': [59, 237.5],
  chicago: [147, 212.5],
  montreal: [216, 210],
  'new-york': [269, 218],
  atlanta: [171, 264],
  washington: [245.5, 259],
  london: [396.5, 176.5],
  madrid: [387, 244.5],
  essen: [465.5, 164.5],
  paris: [448.5, 210.5],
  milan: [494, 197],
  'st-petersburg': [541.5, 150.5],
  'los-angeles': [72, 306.5],
  'mexico-city': [136.5, 329.5],
  miami: [215.5, 319],
  bogota: [209.5, 389],
  lima: [185, 463.5],
  santiago: [194, 539.5],
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
  mumbai: [646.5, 346.5],
  chennai: [700, 384],
  beijing: [778, 214],
  seoul: [839.5, 210.5],
  tokyo: [888, 237.75],
  shanghai: [782.5, 262],
  osaka: [893.5, 290],
  taipei: [843.5, 310.5],
  'hong-kong': [788.5, 320.5],
  bangkok: [748.5, 351],
  'ho-chi-minh-city': [791, 400],
  manila: [858.5, 396],
  jakarta: [748.5, 443.5],
  sydney: [898.5, 537.5],
};

/** A city's position on the map, in picture pixels. */
export const cityPoint = (id: CityId): { x: number; y: number } => {
  const [x, y] = CITY_POINTS[id];
  return { x, y };
};

/** The vial slots at the bottom of the picture: the center of each slot and its top edge. */
export const CURE_SLOTS: Record<Color, { x: number; top: number }> = {
  yellow: { x: 314.75, top: 637.5 },
  red: { x: 360.75, top: 637.5 },
  blue: { x: 406.5, top: 637.5 },
  black: { x: 448.5, top: 637.5 },
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

/** The white frame at the bottom right (the player deck) and the spot beside it for its discard pile. */
export const PLAYER_DECK_FRAME: Frame = { x: 707, y: 509, width: 102.5, height: 143 };
export const PLAYER_DISCARD_FRAME: Frame = { x: 832, y: 586, width: 56, height: 78 };

/** Where each disease's cubes-left counter is: the center of its cube icon (a 2 × 2 block left of the player deck). */
export const SUPPLY_SPOTS: Record<Color, { x: number; y: number }> = {
  yellow: { x: 605, y: 610 },
  red: { x: 660, y: 610 },
  blue: { x: 605, y: 640 },
  black: { x: 660, y: 640 },
};

/** The size of a counter's cube icon. */
export const SUPPLY_ICON_SIZE = 20;

/** Where the research stations-left counter is: the center of its icon, left of the cube counters. */
export const STATION_SUPPLY_SPOT = { x: 548, y: 640 };
