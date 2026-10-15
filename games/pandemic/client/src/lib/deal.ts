// The deal, shown step by step. The server deals the whole board at once; the client plays it
// back from the dealt view: a display view that starts empty and fills on a timeline of about
// 10 seconds (the rulebook's order: the station and the pawns, the starting infections, the
// hands, then the player deck built in its epidemic piles). Only presentation: nothing here
// decides a rule, and the actions stay off until the deal is done.
import type { PandemicView } from '@pandemic/rules';
import { useEffect, useMemo, useState } from 'react';
import { usePandemic } from '../store';

/** How long each part of the deal lasts, in ms (about 10 s in all with 9 infections and 8 to 9 cards). */
export const DEAL_MS = {
  start: 300,
  pawns: 600,
  /** An infection card's flight to the discard pile (`INFECTION_DRAW_MS`); its cubes appear after. */
  infection: 550,
  card: 200,
  pile: 650,
} as const;

/** What the board shows at a moment of the deal. */
export interface DealProgress {
  /** The research station and the pawns are on the map. */
  pawns: boolean;
  /** Starting infection cards flipped so far. */
  infections: number;
  /** Cities with their cubes on the map: each city's cubes appear once its card has landed. */
  cubes: number;
  /** Cards dealt to the hands so far, one at a time, in turn order. */
  dealt: number;
  /** The player deck's epidemic piles: 0 not started, 1 split in piles, 2 epidemics shuffled in, 3 stacked back. */
  piles: 0 | 1 | 2 | 3;
}

export interface DealStep {
  progress: DealProgress;
  /** How long the board stays like this before the next step. */
  ms: number;
}

/** The steps of a deal with this many starting infection cards and cards in the hands. */
export function dealSteps(infectionCards: number, handCards: number): DealStep[] {
  const steps: DealStep[] = [];
  const at = {
    pawns: false,
    infections: 0,
    cubes: 0,
    dealt: 0,
    piles: 0 as DealProgress['piles'],
  };
  const add = (ms: number) => steps.push({ progress: { ...at }, ms });
  add(DEAL_MS.start);
  at.pawns = true;
  add(DEAL_MS.pawns);
  for (let i = 1; i <= infectionCards; i++) {
    at.infections = i;
    // The previous card has landed: its cubes appear while this card flies.
    at.cubes = i - 1;
    add(DEAL_MS.infection);
  }
  if (infectionCards > 0) {
    at.cubes = infectionCards;
    add(DEAL_MS.infection);
  }
  for (let i = 1; i <= handCards; i++) {
    at.dealt = i;
    add(DEAL_MS.card);
  }
  for (const piles of [1, 2, 3] as const) {
    at.piles = piles;
    add(DEAL_MS.pile);
  }
  return steps;
}

/** When each step starts, in ms from the start of the deal, and the deal's whole length. */
export function dealTimes(steps: readonly DealStep[]): { starts: number[]; total: number } {
  const starts: number[] = [];
  let total = 0;
  for (const step of steps) {
    starts.push(total);
    total += step.ms;
  }
  return { starts, total };
}

/**
 * The dealt view as it looks at `progress`: the pieces that are not dealt yet are left out (cubes
 * go back to the supply, cards back to their decks), the others are as dealt.
 */
export function dealView(view: PandemicView, progress: DealProgress): PandemicView {
  const seats = view.seats;
  const handTotal = seats.reduce((sum, seat) => sum + (view.hands[seat]?.length ?? 0), 0);

  // Hands: card by card around the table, in turn order.
  const hands: PandemicView['hands'] = {};
  seats.forEach((seat, i) => {
    const count = Math.max(0, Math.ceil((progress.dealt - i) / seats.length));
    hands[seat] = (view.hands[seat] ?? []).slice(0, count);
  });

  // Starting infections: a city's cubes appear once its card has landed on the discard pile.
  const shown = view.infectionDiscard.slice(0, progress.infections);
  const cubes = structuredClone(view.cubes);
  const supply = { ...view.supply };
  for (const city of view.infectionDiscard.slice(progress.cubes)) {
    for (const color of Object.keys(supply) as (keyof typeof supply)[]) {
      supply[color] += cubes[city][color];
      cubes[city][color] = 0;
    }
  }

  const pawns: PandemicView['pawns'] = progress.pawns ? view.pawns : {};
  return {
    ...view,
    hands,
    cubes,
    supply,
    pawns,
    stations: progress.pawns ? view.stations : [],
    infectionDiscard: shown,
    infectionDeckSize: view.infectionDeckSize + (view.infectionDiscard.length - shown.length),
    playerDeckSize: view.playerDeckSize + (handTotal - progress.dealt),
  };
}

/**
 * The view to draw: while a deal is being played back (it starts when the game turns from the
 * "before the game" step to the dealt board in this session, see the store), the display view of
 * the moment; otherwise the view as it is. `dealing` is true until the deal is done.
 */
export function useDeal<V extends { status: string }>(
  view: V,
): { view: V; dealing: boolean; progress: DealProgress | null } {
  const startedAt = usePandemic((s) => s.dealStartedAt);
  const finishDeal = usePandemic((s) => s.finishDeal);
  const playing = view.status === 'playing';
  const dealt = view as unknown as PandemicView;
  const infectionCards = playing ? dealt.infectionDiscard.length : 0;
  const handCards = playing
    ? dealt.seats.reduce((sum, seat) => sum + (dealt.hands[seat]?.length ?? 0), 0)
    : 0;
  const steps = useMemo(() => dealSteps(infectionCards, handCards), [infectionCards, handCards]);
  const { starts, total } = useMemo(() => dealTimes(steps), [steps]);
  // The step shown, kept with the deal it belongs to (a new deal starts from the first step).
  const [at, setAt] = useState<{ startedAt: number | null; index: number }>({
    startedAt: null,
    index: 0,
  });

  const active = playing && startedAt !== null;
  useEffect(() => {
    if (!active || startedAt === null) return;
    const wait = (ms: number) => Math.max(0, startedAt + ms - Date.now());
    const timers = starts.map((start, index) =>
      setTimeout(() => setAt({ startedAt, index }), wait(start)),
    );
    timers.push(setTimeout(finishDeal, wait(total)));
    return () => timers.forEach(clearTimeout);
  }, [active, startedAt, starts, total, finishDeal]);

  if (!active) return { view, dealing: false, progress: null };
  const index = at.startedAt === startedAt ? at.index : 0;
  const progress = (steps[index] as DealStep).progress;
  return { view: dealView(dealt, progress) as unknown as V, dealing: true, progress };
}
