// A random player for tests and the random-play script. It plays legal moves, with a taste for
// the useful ones (cure, treat, walk to infected cities, gather cards), so that games last long
// enough to be won or to run out of cards, not only to be lost to outbreaks.
import type { NextMove } from '@platform/engine/testing';
import { CITIES, COLORS, cityOf, type CityId, type Color } from './cities';
import { cardsToCure, cubesOnBoard, isPawnMove } from './actions';
import { MAX_CARRIED_CUBES, carriesAlong, type Carry } from './carry';
import { cureHelpOf } from './cure';
import { canCarryOnAccept } from './moveOffer';
import { legalActions, legalRoleActions, legalShareOffers } from './legal';
import { actingPawn, pawnsOf } from './pawns';
import { canPlayCard, heldEvents } from './playEvent';
import { checkMove, type PandemicMove } from './moves';
import { shareAnswerer } from './share';
import {
  MAX_STATIONS,
  ROLE_IDS,
  pawnOwner,
  pawnsOnMap,
  type EventId,
  type PawnId,
  type GameState,
  type HandCard,
  type PandemicState,
  type SeatId,
  type SetupState,
} from './types';

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

/** Some of the cubes in `pawn`'s city and maybe a pawn there, for a pawn that takes them along. */
function randomCarry(state: GameState, pawn: PawnId, random: () => number): Carry {
  const from = state.pawns[pawn] as CityId;
  const cubes = COLORS.flatMap((color) => Array<Color>(state.cubes[from][color]).fill(color));
  const taken: Color[] = [];
  while (cubes.length > 0 && taken.length < MAX_CARRIED_CUBES && random() < 0.7) {
    taken.push(...cubes.splice(Math.floor(random() * cubes.length), 1));
  }
  const others = pawnsOnMap(state).filter((other) => other !== pawn && state.pawns[other] === from);
  const along = others.length > 0 && random() < 0.4 ? pick(others, random) : undefined;
  return { cubes: taken, ...(along && { pawn: along }) };
}

/** `move`, now and then taking things along when it moves `by`'s own pawn and that pawn carries. */
function maybeCarry(state: GameState, by: SeatId, move: PandemicMove, random: () => number) {
  const pawn = 'pawn' in move && move.pawn !== undefined ? move.pawn : actingPawn(state, by);
  const moves = isPawnMove(move) || (move.type === 'play-event' && move.event === 'airlift');
  if (!moves || pawnOwner(pawn) !== by || !carriesAlong(state, pawn) || random() >= 0.4) {
    return move;
  }
  return { ...move, carry: randomCarry(state, pawn, random) } as PandemicMove;
}

/**
 * A cure with other players' cards, for a role that may use them (Z-Force Team Member): its own
 * cards of a color first, the rest from the players in its city; `null` if none is legal.
 */
function helpedCure(state: GameState, by: SeatId): PandemicMove | null {
  const allowed = cureHelpOf(state, by);
  if (allowed === 0) return null;
  const here = state.pawns[actingPawn(state, by)] as CityId;
  const ofColor = (seat: SeatId, color: Color): CityId[] =>
    (state.hands[seat] ?? []).flatMap((card) =>
      card.kind === 'city' && cityOf(card.city).color === color ? [card.city] : [],
    );
  const helpers = state.seats.filter(
    (seat) => seat !== by && pawnsOf(state, seat).some((pawn) => state.pawns[pawn] === here),
  );
  for (const color of COLORS) {
    const needed = cardsToCure(state, by);
    const cards = ofColor(by, color).slice(0, needed);
    const help = helpers
      .flatMap((seat) => ofColor(seat, color).map((city) => ({ seat, city })))
      .slice(0, Math.min(allowed, needed - cards.length));
    const move: PandemicMove = { type: 'cure', color, cards, help };
    if (help.length > 0 && checkMove(state, by, move).ok) return move;
  }
  return null;
}

/** A random way to play `event` (it may turn out illegal: the caller checks it). */
function eventMove(state: GameState, event: EventId, random: () => number): PandemicMove | null {
  switch (event) {
    case 'airlift':
      return {
        type: 'play-event',
        event,
        pawn: pick(pawnsOnMap(state), random),
        to: pick(CITIES, random).id,
      };
    case 'forecast':
    case 'one-quiet-night':
      return { type: 'play-event', event };
    case 'government-grant': {
      const city = pick(CITIES, random).id;
      const move = state.stations.length >= MAX_STATIONS ? pick(state.stations, random) : undefined;
      return { type: 'play-event', event, city, ...(move && { move }) };
    }
    case 'resilient-population':
      return state.infectionDiscard.length > 0
        ? { type: 'play-event', event, city: pick(state.infectionDiscard, random) }
        : null;
  }
}

/** Some seat playing one of its event cards, if one can (out of turn too), or `null`. */
function randomEvent(state: GameState, random: () => number): NextMove<PandemicMove> | null {
  for (const by of [...state.seats].sort(() => random() - 0.5)) {
    for (const event of heldEvents(state, by)) {
      if (!canPlayCard(state, by, event)) continue;
      const plain = eventMove(state, event, random);
      const move = plain && maybeCarry(state, by, plain, random);
      if (move && checkMove(state, by, move).ok) return { by, move };
    }
  }
  return null;
}

/** Before the game: someone picks a free role (now and then changing it), or confirms. */
function preflightMove(state: SetupState, random: () => number): NextMove<PandemicMove> {
  const waiting = state.seats.filter((seat) => !state.confirmed.includes(seat));
  const by = pick(waiting, random);
  const free = ROLE_IDS.filter((role) => !state.seats.some((seat) => state.picks[seat] === role));
  const choose = state.roleMode === 'choose' && free.length > 0;
  if (choose && (!state.picks[by] || random() < 0.2)) {
    return { by, move: { type: 'pick-role', role: pick(free, random) } };
  }
  return { by, move: { type: 'confirm' } };
}

/** The next move of a random game: any seat, in any state. */
export function agentMove(table: PandemicState, random: () => number): NextMove<PandemicMove> {
  if (table.status === 'waiting') throw new Error('random play needs every seat taken');
  if (table.status === 'setup') return preflightMove(table, random);
  const state: GameState = table;
  const { pending, turn } = state;
  if (pending?.kind === 'discard') {
    const card = cardToDiscard(state.hands[pending.seat] as HandCard[]);
    return { by: pending.seat, move: { type: 'discard', card } };
  }
  if (pending?.kind === 'move') {
    if (random() < 0.05) return { by: pending.by, move: { type: 'move-cancel' } };
    const by = pawnOwner(pending.pawn);
    if (random() >= 0.9) return { by, move: { type: 'move-decline' } };
    // A pawn that takes things along chooses them when accepting, now and then.
    const carry = canCarryOnAccept(state) && random() < 0.5;
    return {
      by,
      move: carry
        ? { type: 'move-accept', carry: randomCarry(state, pending.pawn, random) }
        : { type: 'move-accept' },
    };
  }
  if (pending?.kind === 'cure') {
    if (random() < 0.05) return { by: pending.by, move: { type: 'cure-cancel' } };
    const by = pick(pending.waiting, random);
    return { by, move: { type: random() < 0.9 ? 'cure-accept' : 'cure-decline' } };
  }
  if (pending?.kind === 'forecast') {
    // Puts the cards back as they were or upside down: any order is legal.
    const cards = random() < 0.5 ? [...pending.cards] : [...pending.cards].reverse();
    return { by: pending.seat, move: { type: 'forecast-order', cards } };
  }
  if (pending?.kind === 'share') {
    if (random() < 0.05) return { by: turn.seat, move: { type: 'share-cancel' } };
    const by = shareAnswerer(state) as SeatId;
    return { by, move: { type: random() < 0.9 ? 'share-accept' : 'share-decline' } };
  }

  // Event cards, now and then, whoever holds one and whoever's turn it is.
  if (random() < 0.1) {
    const play = randomEvent(state, random);
    if (play) return play;
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
      // A seat with several pawns (a Teacher with students) first picks one for the turn.
      if (turn.pawn === null) {
        return { by, move: { type: 'choose-pawn', pawn: pick(pawnsOf(state, by), random) } };
      }
      return { by, move: maybeCarry(state, by, actionMove(state, by, random), random) };
  }
}

function actionMove(state: GameState, by: SeatId, random: () => number): PandemicMove {
  const actions = legalActions(state, by);
  const here = state.pawns[actingPawn(state, by)] as CityId;
  const hand = state.hands[by] ?? [];

  // A role's own power now and then.
  const powers = legalRoleActions(state, by);
  if (powers.length > 0 && random() < 0.15) return pick(powers, random);

  const cure = actions.find((action) => action.type === 'cure') ?? helpedCure(state, by);
  if (cure) return cure;

  // Hold the cards for a cure: get to a research station.
  const counts = countByColor(hand);
  const ready = COLORS.some(
    (color) => state.cures[color] === 'none' && counts[color] >= cardsToCure(state, by),
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
