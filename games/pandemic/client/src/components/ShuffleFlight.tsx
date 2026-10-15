import { useLayoutEffect, useRef } from 'react';
import { infectionBackUrl } from '../lib/cardImages';
import { INFECTION_DECK_FRAME, INFECTION_DISCARD_FRAME } from '../lib/mapGeometry';

/** The shuffle, then the flight onto the deck (the whole animation, in ms). */
export const SHUFFLE_MS = 1300;
const MAX_CARDS = 7;

const { width: W, height: H } = INFECTION_DISCARD_FRAME;
const at = (x: number, y: number, turn = 0) => `translate(${x}px, ${y}px) rotate(${turn}deg)`;

/** A small, fixed jitter for card `i` (the same every time, so the animation is steady). */
const jitter = (i: number, step: number) => ({
  x: (((i * 7 + step * 5) % 9) - 4) * 4,
  y: (((i * 5 + step * 3) % 7) - 3) * 3,
  turn: (((i * 3 + step * 2) % 9) - 4) * 3,
});

function Card({ index }: { index: number }) {
  const group = useRef<SVGGElement>(null);
  const from = INFECTION_DISCARD_FRAME;
  const to = INFECTION_DECK_FRAME;
  useLayoutEffect(() => {
    const spot = (step: number) => {
      const j = jitter(index, step);
      return at(from.x + j.x, from.y + j.y, j.turn);
    };
    group.current?.animate(
      [
        { transform: at(from.x, from.y), opacity: 1, offset: 0 },
        { transform: spot(1), opacity: 1, offset: 0.12 },
        { transform: spot(2), opacity: 1, offset: 0.24 },
        { transform: spot(3), opacity: 1, offset: 0.36 },
        { transform: spot(4), opacity: 1, offset: 0.48 },
        { transform: at(from.x, from.y), opacity: 1, offset: 0.58 },
        { transform: at(to.x, to.y), opacity: 1, offset: 0.95 },
        { transform: at(to.x, to.y), opacity: 0, offset: 1 },
      ],
      { duration: SHUFFLE_MS, delay: (index * 40) % 200, easing: 'ease-in-out', fill: 'both' },
    );
    // Once: the cards of one shuffle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <g
      ref={group}
      style={{ transform: at(from.x, from.y), transformOrigin: `${W / 2}px ${H / 2}px` }}
      data-shuffle-card={index}
      aria-hidden="true"
    >
      <image href={infectionBackUrl()} width={W} height={H} />
    </g>
  );
}

/**
 * The infection discard pile shuffled and put back on top of the infection deck (an epidemic's
 * Intensify step): a handful of card backs shuffle where the pile was, then fly onto the deck.
 * Draw it as a child of the map's <svg>, in map coordinates.
 */
export function ShuffleFlight({ cards, onDone }: { cards: number; onDone: () => void }) {
  const done = useRef(onDone);
  useLayoutEffect(() => {
    const timer = setTimeout(() => done.current(), SHUFFLE_MS + 300);
    return () => clearTimeout(timer);
  }, []);
  const shown = Math.min(Math.max(cards, 1), MAX_CARDS);
  return (
    <g pointerEvents="none">
      {Array.from({ length: shown }, (_, i) => (
        <Card key={i} index={i} />
      ))}
    </g>
  );
}
