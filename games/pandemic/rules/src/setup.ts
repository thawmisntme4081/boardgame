// Setting up a game from a seed: the same seed always gives the same game.
import { nextRandom } from '@platform/engine';
import { CITIES, cityOf, type CityId, type Color } from './cities';
import {
  ACTIONS_PER_TURN,
  CUBES_PER_COLOR,
  EPIDEMIC_COUNTS,
  EVENT_IDS,
  HAND_SIZES,
  MAX_PLAYERS,
  MIN_PLAYERS,
  SETUP_INFECTIONS,
  START_CITY,
  type Cubes,
  type GameState,
  type HandCard,
  type PerSeat,
  type PlayerCard,
  type SeatId,
} from './types';

export interface CreateGameOptions {
  /** The seated players (2 to 4); their turn order is shuffled. */
  seats: readonly SeatId[];
  /** Epidemic cards in the player deck: 4 (introductory), 5 (standard) or 6 (heroic). */
  epidemics: number;
  seed: number;
}

/** Fisher-Yates with the seeded RNG; returns the shuffled copy and the next RNG state. */
export function shuffle<T>(
  items: readonly T[],
  rngState: number,
): { items: T[]; rngState: number } {
  const out = [...items];
  let state = rngState;
  for (let i = out.length - 1; i > 0; i--) {
    const next = nextRandom(state);
    state = next.rngState;
    const j = Math.floor(next.value * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return { items: out, rngState: state };
}

/** Sizes of `piles` piles that are as equal as possible, the larger ones first. */
export function pileSizes(total: number, piles: number): number[] {
  const base = Math.floor(total / piles);
  const extra = total % piles;
  return Array.from({ length: piles }, (_, i) => base + (i < extra ? 1 : 0));
}

const emptyCubes = (): Cubes => ({ blue: 0, yellow: 0, black: 0, red: 0 });
const perColor = <T>(value: T): Record<Color, T> => ({
  blue: value,
  yellow: value,
  black: value,
  red: value,
});

export function createGame({ seats, epidemics, seed }: CreateGameOptions): GameState {
  if (
    seats.length < MIN_PLAYERS ||
    seats.length > MAX_PLAYERS ||
    new Set(seats).size !== seats.length
  ) {
    throw new Error(`A game needs ${MIN_PLAYERS} to ${MAX_PLAYERS} different seats`);
  }
  if (!EPIDEMIC_COUNTS.includes(epidemics)) {
    throw new Error(`Epidemic cards must be one of ${EPIDEMIC_COUNTS.join(', ')}`);
  }

  let rngState = seed;

  // Turn order.
  const order = shuffle(seats, rngState);
  rngState = order.rngState;

  // Player deck: shuffle the city and event cards, deal the hands.
  const cards: HandCard[] = [
    ...CITIES.map((city): HandCard => ({ kind: 'city', city: city.id })),
    ...EVENT_IDS.map((event): HandCard => ({ kind: 'event', event })),
  ];
  const shuffled = shuffle(cards, rngState);
  rngState = shuffled.rngState;
  const deal = [...shuffled.items];
  const handSize = HAND_SIZES[order.items.length] as number;
  const hands: PerSeat<HandCard[]> = {};
  for (const seat of order.items) hands[seat] = deal.splice(0, handSize);

  // Epidemics: equal piles, an epidemic shuffled into each, the smaller piles at the bottom.
  const sizes = pileSizes(deal.length, epidemics);
  const playerDeck: PlayerCard[] = [];
  let at = 0;
  for (const size of sizes) {
    const pile = shuffle<PlayerCard>(
      [...deal.slice(at, at + size), { kind: 'epidemic' }],
      rngState,
    );
    rngState = pile.rngState;
    playerDeck.push(...pile.items);
    at += size;
  }

  // Infection deck and the nine starting infections.
  const infection = shuffle<CityId>(
    CITIES.map((city) => city.id),
    rngState,
  );
  rngState = infection.rngState;
  const infectionDeck = infection.items;
  const cubes = Object.fromEntries(CITIES.map((city) => [city.id, emptyCubes()])) as Record<
    CityId,
    Cubes
  >;
  const supply = perColor(CUBES_PER_COLOR);
  const infectionDiscard: CityId[] = [];
  for (const count of SETUP_INFECTIONS) {
    for (let i = 0; i < 3; i++) {
      const city = infectionDeck.shift() as CityId;
      const color = cityOf(city).color;
      cubes[city][color] += count;
      supply[color] -= count;
      infectionDiscard.push(city);
    }
  }

  const pawns: PerSeat<CityId> = {};
  for (const seat of order.items) pawns[seat] = START_CITY;

  return {
    seats: order.items,
    epidemics,
    turn: {
      seat: order.items[0] as SeatId,
      actionsLeft: ACTIONS_PER_TURN,
      step: 'actions',
      epidemics: 0,
      epidemicStep: 'increase',
      infectionsLeft: 0,
    },
    pending: null,
    status: 'playing',
    lossReason: null,
    pawns,
    hands,
    cubes,
    supply,
    stations: [START_CITY],
    playerDeck,
    playerDiscard: [],
    infectionDeck,
    infectionDiscard,
    outbreaks: 0,
    infectionRate: 0,
    cures: perColor('none'),
    rngSeed: seed,
    rngState,
  };
}
