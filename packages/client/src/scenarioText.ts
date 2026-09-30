// Names and one-line rules for the Flight Log modules and Special Ability cards.
import type { AbilityId, Difficulty, ModuleId } from '@sky/shared';

export const MODULE_TEXT: Record<ModuleId, { name: string; rule: string }> = {
  kerosene: {
    name: 'Kerosene',
    rule: 'A die on the Kerosene space burns its value; a round without one burns 6. Empty tank: you lose.',
  },
  'kerosene-leak': {
    name: 'Kerosene leak',
    rule: 'No Kerosene space: each round burns the difference between the engine dice + 1.',
  },
  intern: {
    name: 'Intern',
    rule: 'A die (not the next token’s number) on your Intern space takes a token; place it like a die. Train all 6 before landing.',
  },
  wind: {
    name: 'Wind',
    rule: 'After the axis, the wind ring turns by the axis tilt; the wind speed adds to the engines.',
  },
  'real-time': {
    name: 'Real-time',
    rule: '60 seconds per round from the roll; unplaced dice are lost.',
  },
  'ice-brakes': {
    name: 'Ice brakes',
    rule: 'Pairs of 2, 3, 4, 5 above and below the track, left to right, in one round. Pass the 5 to land.',
  },
};

export const ABILITY_TEXT: Record<AbilityId, { name: string; rule: string }> = {
  adaptation: {
    name: 'Adaptation',
    rule: 'Once per game each: turn one of your dice to its opposite side.',
  },
  anticipation: {
    name: 'Anticipation',
    rule: 'Each round the first player may reroll one die before placing their first.',
  },
  control: { name: 'Control', rule: 'Two equal Axis dice: gain a coffee.' },
  mastery: { name: 'Mastery', rule: 'Two equal Engine dice: gain a reroll token, if one is left.' },
  synchronisation: {
    name: 'Synchronisation',
    rule: 'Dice on Landing Gear and Flaps in a round: the co-pilot places the traffic die on any space.',
  },
  'working-together': {
    name: 'Working Together',
    rule: 'Once per round: each player puts a die on the card and the two swap values.',
  },
};

/** The scenario colour dot. */
export const DIFFICULTY_DOT: Record<Difficulty, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-600',
  black: 'bg-neutral-900 ring-1 ring-neutral-400',
};
