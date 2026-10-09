import type { CityId, Color } from '@pandemic/rules';

export const MAP_WIDTH = 950;
export const MAP_HEIGHT = 690;

const CITY_POINTS: Record<CityId, readonly [x: number, y: number]> = {
  'san-francisco': [57, 238],
  chicago: [147, 213],
  montreal: [215, 209],
  'new-york': [268, 217],
  atlanta: [169, 267],
  washington: [245, 259],
  london: [393, 176],
  madrid: [388, 243],
  essen: [463, 163],
  paris: [448, 210],
  milan: [492, 197],
  'st-petersburg': [541, 150],
  'los-angeles': [72, 306],
  'mexico-city': [136, 328],
  miami: [215, 319],
  bogota: [208, 387],
  lima: [185, 463],
  santiago: [194, 538],
  'buenos-aires': [266, 525],
  'sao-paulo': [306, 473],
  lagos: [441, 375],
  khartoum: [528, 364],
  kinshasa: [484, 424],
  johannesburg: [523, 494],
  moscow: [578, 196],
  tehran: [627, 230],
  istanbul: [524, 237],
  baghdad: [574, 272],
  algiers: [462, 281],
  cairo: [514, 296],
  riyadh: [583, 336],
  karachi: [640, 293],
  delhi: [688, 274],
  kolkata: [738, 291],
  mumbai: [648, 344],
  chennai: [700, 382],
  beijing: [782, 213],
  seoul: [839, 211],
  tokyo: [888, 238],
  shanghai: [782, 262],
  osaka: [895, 289],
  taipei: [845, 310],
  'hong-kong': [787, 320],
  bangkok: [747, 350],
  'ho-chi-minh-city': [792, 399],
  manila: [858, 396],
  jakarta: [749, 442],
  sydney: [898, 537],
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
