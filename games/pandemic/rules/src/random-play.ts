// A random player for tests and the random-play script. It plays legal moves, with a taste for
// the useful ones (cure, treat, walk to infected cities, gather cards), so that games last long
// enough to be won or to run out of cards, not only to be lost to outbreaks.
import type { NextMove } from '@platform/engine/testing';
import { COLORS, cityOf, type CityId, type Color } from './cities';
import { cubesOnBoard } from './actions';
import { legalActions, legalShareOffers } from './legal';
import type { PandemicMove } from './moves';
import { shareAnswerer } from './share';
import { CARDS_TO_CURE, type GameState, type HandCard, type SeatId } from './types';

const pick = <T>(items: readonly T[], random: () => number): T =>
  items[Math.floor(random() * items.length)] as T;

/** City cards of each color in a hand. */
function countByColor(hand: readonly HandCard[]): Record<Color, number> {
  const counts: Record<Color, number> = { blue: 0, yellow: 0, black: 0, red: 0 };
  for (const card of hand) if (card.kind === 'city') counts[cityOf(card.city).color] += 1;
  return counts;
}

/** The first step of a shortest walk from `from` to a city that satisfies `goal`. */
function stepToward(from: CityId, goal: (city: CityId) => boolean): CityId | null {
  const first = new Map<CityId, CityId>();
  const queue: CityId[] = [];
  for (const next of cityOf(from).links) {
    first.set(next, next);
    queue.push(next);
  }
  for (let city = queue.shift(); city !== undefined; city = queue.shift()) {
    if (goal(city)) return first.get(city) ?? null;
    for (const next of cityOf(city).links) {
      if (next !== from && !first.has(next)) {
        first.set(next, first.get(city) as CityId);
        queue.push(next);
      }
    }
  }
  return null;
}

/** The card to give up when over the hand limit: one of the color held least. */
function cardToDiscard(hand: readonly HandCard[]): HandCard {
  const counts = countByColor(hand);
  const cities = hand.filter((card) => card.kind === 'city');
  const pool = cities.length > 0 ? cities : hand;
  return pool.reduce((best, card) => {
    const own = card.kind === 'city' ? counts[cityOf(card.city).color] : 99;
    const have = best.kind === 'city' ? counts[cityOf(best.city).color] : 99;
    return own < have ? card : best;
  });
}

/** The next move of a random game: any seat, in any state. */
export function agentMove(state: GameState, random: () => number): NextMove<PandemicMove> {
  const { pending, turn } = state;
  if (pending?.kind === 'discard') {
    const card = cardToDiscard(state.hands[pending.seat] as HandCard[]);
    return { by: pending.seat, move: { type: 'discard', card } };
  }
  if (pending?.kind === 'share') {
    if (random() < 0.05) return { by: turn.seat, move: { type: 'share-cancel' } };
    const by = shareAnswerer(state) as SeatId;
    return { by, move: { type: random() < 0.9 ? 'share-accept' : 'share-decline' } };
  }

  const by = turn.seat;
  switch (turn.step) {
    case 'draw':
      return { by, move: { type: 'draw' } };
    case 'epidemic':
      return { by, move: { type: 'epidemic' } };
    case 'infect':
      return { by, move: { type: 'infect' } };
    case 'actions':
      return { by, move: actionMove(state, by, random) };
  }
}

function actionMove(state: GameState, by: SeatId, random: () => number): PandemicMove {
  const actions = legalActions(state, by);
  const here = state.pawns[by] as CityId;
  const hand = state.hands[by] ?? [];

  const cure = actions.find((action) => action.type === 'cure');
  if (cure) return cure;

  // Hold the cards for a cure: get to a research station.
  const counts = countByColor(hand);
  const ready = COLORS.some(
    (color) => state.cures[color] === 'none' && counts[color] >= CARDS_TO_CURE,
  );
  if (ready) {
    const build = actions.find((action) => action.type === 'build');
    if (build) return build;
    const shuttle = actions.find((action) => action.type === 'shuttle');
    if (shuttle) return shuttle;
    const to = stepToward(here, (city) => state.stations.includes(city));
    const drive = actions.find((action) => action.type === 'drive' && action.to === to);
    if (drive) return drive;
  }

  const treats = actions.filter((action) => action.type === 'treat');
  if (treats.length > 0 && random() < 0.9) return pick(treats, random);

  // Send cards where they make a set.
  const offers = legalShareOffers(state, by);
  if (offers.length > 0 && random() < 0.6) return pick(offers, random);

  // Walk to the nearest city with cubes.
  const infected = (city: CityId) => COLORS.some((color) => state.cubes[city][color] > 0);
  if (COLORS.some((color) => cubesOnBoard(state, color) > 0) && random() < 0.85) {
    const to = stepToward(here, infected);
    const drive = actions.find((action) => action.type === 'drive' && action.to === to);
    if (drive) return drive;
  }

  const builds = actions.filter((action) => action.type === 'build');
  if (builds.length > 0 && random() < 0.3) return pick(builds, random);
  return pick(actions, random);
}
