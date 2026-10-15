// Pandemic 06: the deal played back step by step (the timeline and the display view).
import { COLORS, createGame, viewFor, type PandemicView, type SeatId } from '@pandemic/rules';
import { describe, expect, it } from 'vitest';
import { dealSteps, dealTimes, dealView } from './deal';

const SEAT_IDS: SeatId[] = ['p1', 'p2', 'p3', 'p4'];

function dealt(players: number, epidemics = 5, seed = 3): PandemicView {
  const game = createGame({ seats: SEAT_IDS.slice(0, players), epidemics, seed });
  return viewFor(game, 'p1');
}
const handCards = (view: PandemicView) =>
  view.seats.reduce((sum, seat) => sum + (view.hands[seat]?.length ?? 0), 0);
const stepsOf = (view: PandemicView) => dealSteps(view.infectionDiscard.length, handCards(view));
const cubeTotal = (view: PandemicView) =>
  Object.values(view.cubes).reduce(
    (sum, c) => sum + COLORS.reduce((s, color) => s + c[color], 0),
    0,
  );
const supplyTotal = (view: PandemicView) =>
  COLORS.reduce((sum, color) => sum + view.supply[color], 0);

describe('the deal timeline', () => {
  it('lasts about ten seconds for 2, 3 and 4 players', () => {
    for (const players of [2, 3, 4]) {
      const { total } = dealTimes(stepsOf(dealt(players)));
      expect(total).toBeGreaterThan(9000);
      expect(total).toBeLessThan(11000);
    }
  });

  it('goes in the rulebook order: pawns, infections, hands, then the deck built in 3 steps', () => {
    const view = dealt(3);
    const steps = stepsOf(view);
    const at = (predicate: (s: (typeof steps)[number]) => boolean) => steps.findIndex(predicate);
    const pawns = at((s) => s.progress.pawns);
    const firstInfection = at((s) => s.progress.infections > 0);
    const firstCard = at((s) => s.progress.dealt > 0);
    const firstPile = at((s) => s.progress.piles > 0);
    expect(steps[0]?.progress).toEqual({
      pawns: false,
      infections: 0,
      cubes: 0,
      dealt: 0,
      piles: 0,
    });
    expect(pawns).toBeLessThan(firstInfection);
    expect(firstInfection).toBeLessThan(firstCard);
    expect(firstCard).toBeLessThan(firstPile);
    expect(steps.at(-1)?.progress).toMatchObject({
      pawns: true,
      infections: 9,
      cubes: 9,
      dealt: handCards(view),
      piles: 3,
    });
    // A card is flipped before its cubes appear.
    for (const { progress } of steps)
      expect(progress.cubes).toBeLessThanOrEqual(progress.infections);
  });
});

describe('the display view of the deal', () => {
  it('starts empty: no pieces, no cubes, no hands, the decks full', () => {
    const view = dealt(3);
    const first = dealView(view, stepsOf(view)[0]!.progress);
    expect(first.pawns).toEqual({});
    expect(first.stations).toEqual([]);
    expect(cubeTotal(first)).toBe(0);
    expect(first.infectionDiscard).toEqual([]);
    expect(first.infectionDeckSize).toBe(48);
    expect(handCards(first)).toBe(0);
    expect(first.playerDeckSize).toBe(view.playerDeckSize + handCards(view));
  });

  it('ends as the dealt view', () => {
    for (const players of [2, 3, 4]) {
      const view = dealt(players);
      expect(dealView(view, stepsOf(view).at(-1)!.progress)).toEqual(view);
    }
  });

  it('never loses a cube or a card on the way, and only ever adds pieces', () => {
    const view = dealt(4, 6, 8);
    let cubes = 0;
    let discard = 0;
    let hands = 0;
    for (const { progress } of stepsOf(view)) {
      const shown = dealView(view, progress);
      expect(cubeTotal(shown) + supplyTotal(shown)).toBe(96);
      expect(shown.infectionDeckSize + shown.infectionDiscard.length).toBe(48);
      expect(shown.playerDeckSize + handCards(shown)).toBe(view.playerDeckSize + handCards(view));
      expect(cubeTotal(shown)).toBeGreaterThanOrEqual(cubes);
      expect(shown.infectionDiscard.length).toBeGreaterThanOrEqual(discard);
      expect(handCards(shown)).toBeGreaterThanOrEqual(hands);
      cubes = cubeTotal(shown);
      discard = shown.infectionDiscard.length;
      hands = handCards(shown);
    }
    expect(cubes).toBe(18);
  });

  it("puts a city's cubes on the map once its card has landed, in the order the cards were drawn", () => {
    const view = dealt(2);
    const steps = stepsOf(view);
    // The first 3 cities have 3 cubes, the next 3 have 2, the last 3 have 1.
    const after = (n: number) =>
      dealView(view, steps.find((s) => s.progress.cubes === n)!.progress);
    expect(cubeTotal(after(1))).toBe(3);
    expect(cubeTotal(after(3))).toBe(9);
    expect(cubeTotal(after(6))).toBe(15);
    expect(cubeTotal(after(9))).toBe(18);
    const second = view.infectionDiscard[1] as string;
    expect(
      Object.values(after(2).cubes[second as keyof typeof view.cubes]).reduce((a, b) => a + b, 0),
    ).toBe(3);
  });

  it('deals the hands card by card around the table, in turn order', () => {
    const view = dealt(3);
    const steps = stepsOf(view);
    const [a, b, c] = view.seats as [SeatId, SeatId, SeatId];
    const count = (n: number, seat: SeatId) =>
      dealView(view, steps.find((s) => s.progress.dealt === n)!.progress).hands[seat]?.length ?? 0;
    expect([count(1, a), count(1, b), count(1, c)]).toEqual([1, 0, 0]);
    expect([count(2, a), count(2, b), count(2, c)]).toEqual([1, 1, 0]);
    expect([count(4, a), count(4, b), count(4, c)]).toEqual([2, 1, 1]);
    // Cards are only ever added to a hand, never swapped.
    expect(dealView(view, steps.find((s) => s.progress.dealt === 5)!.progress).hands[a]).toEqual(
      view.hands[a]?.slice(0, 2),
    );
  });
});
