// The game's state and constants. State is plain JSON (it is saved and replayed), and the
// rules in the other files are pure functions over it.
import type { CityId, Color } from './cities';

export type SeatId = 'p1' | 'p2' | 'p3' | 'p4';

export const SEATS: readonly SeatId[] = ['p1', 'p2', 'p3', 'p4'];

/** A value per seated player (a game has 2 to 4 seats, so not every seat has one). */
export type PerSeat<T> = Partial<Record<SeatId, T>>;

// Constants from the rulebook.
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const ACTIONS_PER_TURN = 4;
export const HAND_LIMIT = 7;
export const CARDS_TO_CURE = 5;
export const CUBES_PER_COLOR = 24;
export const MAX_STATIONS = 6;
export const MAX_OUTBREAKS = 8;
/** Cities infected at the end of a turn, by the position of the infection rate marker. */
export const INFECTION_RATES: readonly number[] = [2, 2, 2, 3, 3, 4, 4];
/** Cards in each starting hand, by number of players. */
export const HAND_SIZES: Readonly<Record<number, number>> = { 2: 4, 3: 3, 4: 2 };
/** Epidemic cards in the player deck: introductory, standard, heroic. */
export const EPIDEMIC_COUNTS: readonly number[] = [4, 5, 6];
/** Cities infected at setup, in groups of three, with 3, 2 and 1 cubes. */
export const SETUP_INFECTIONS: readonly number[] = [3, 2, 1];
export const START_CITY: CityId = 'atlanta';

/** Event cards (their rules come in Pandemic 05). */
export const EVENT_IDS = [
  'airlift',
  'forecast',
  'government-grant',
  'one-quiet-night',
  'resilient-population',
] as const;
export type EventId = (typeof EVENT_IDS)[number];

/** Roles (their rules come in Pandemic 04). */
export const ROLE_IDS = [
  'contingency-planner',
  'dispatcher',
  'medic',
  'operations-expert',
  'quarantine-specialist',
  'researcher',
  'scientist',
] as const;
export type RoleId = (typeof ROLE_IDS)[number];

/** A card of the player deck. Epidemics are only ever in the deck, never in a hand. */
export type PlayerCard =
  { kind: 'city'; city: CityId } | { kind: 'event'; event: EventId } | { kind: 'epidemic' };

/** A card a player can hold. */
export type HandCard = Exclude<PlayerCard, { kind: 'epidemic' }>;

/** Disease cubes on a city, by color (at most 3 of each). */
export type Cubes = Record<Color, number>;

export type CureState = 'none' | 'cured' | 'eradicated';

/** The parts of a turn, in order; an epidemic resolves between `draw` and `infect`. */
export type TurnStep = 'actions' | 'draw' | 'epidemic' | 'infect';

/** The three steps of an epidemic card. */
export type EpidemicStep = 'increase' | 'infect' | 'intensify';

export interface Turn {
  seat: SeatId;
  actionsLeft: number;
  step: TurnStep;
  /** Epidemic cards drawn and not yet resolved. */
  epidemics: number;
  /** The next step of the epidemic being resolved. */
  epidemicStep: EpidemicStep;
  /** Infection cards still to flip in the infect step. */
  infectionsLeft: number;
}

/** Something that must be answered before play goes on. */
export type Pending =
  /** The active player offered to give or take a city card; the partner answers. */
  | { kind: 'share'; from: SeatId; to: SeatId; city: CityId }
  /** A hand over the limit: this seat discards (or plays an event) first. */
  | { kind: 'discard'; seat: SeatId };

export type LossReason = 'outbreaks' | 'cubes' | 'player-deck';

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  /** Turn order, fixed at setup (random). */
  seats: SeatId[];
  /** Epidemic cards in the player deck (4, 5 or 6). */
  epidemics: number;
  turn: Turn;
  pending: Pending | null;
  status: GameStatus;
  lossReason: LossReason | null;
  pawns: PerSeat<CityId>;
  hands: PerSeat<HandCard[]>;
  cubes: Record<CityId, Cubes>;
  /** Cubes left in the supply, by color. */
  supply: Record<Color, number>;
  /** Cities with a research station. */
  stations: CityId[];
  /** Top card first. */
  playerDeck: PlayerCard[];
  playerDiscard: HandCard[];
  /** Top card first, so the bottom card is the last. */
  infectionDeck: CityId[];
  infectionDiscard: CityId[];
  outbreaks: number;
  /** Position of the infection rate marker on `INFECTION_RATES`. */
  infectionRate: number;
  cures: Record<Color, CureState>;
  rngSeed: number;
  rngState: number;
}

/**
 * What the checks of a move read: the full state, or a player's view (which has these fields),
 * so the client can highlight moves with the same rules the server uses.
 */
export type ActionState = Pick<
  GameState,
  'seats' | 'status' | 'turn' | 'pending' | 'pawns' | 'hands' | 'cubes' | 'stations' | 'cures'
>;
