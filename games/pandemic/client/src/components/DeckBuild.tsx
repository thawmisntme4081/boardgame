import { useLayoutEffect, useRef } from 'react';
import { epidemicCardUrl, playerBackUrl } from '../lib/cardImages';
import { PLAYER_DECK_FRAME } from '../lib/mapGeometry';

/** A small face-down pile (a player card shrunk), and the row the piles are laid out in. */
const CARD = { width: 41, height: 57 };
const GAP = 10;
const ROW_Y = 430;
const DECK_CENTER_X = PLAYER_DECK_FRAME.x + PLAYER_DECK_FRAME.width / 2;
const SHRINK = CARD.width / PLAYER_DECK_FRAME.width;

const at = (x: number, y: number, scale = 1) => `translate(${x}px, ${y}px) scale(${scale})`;

/** One pile of the deck being built: it leaves the deck, gets its Epidemic card, goes back. */
function MiniPile({ index, count, stage }: { index: number; count: number; stage: 1 | 2 | 3 }) {
  const group = useRef<SVGGElement>(null);
  const epidemic = useRef<SVGGElement>(null);
  const rowWidth = count * CARD.width + (count - 1) * GAP;
  const slot = { x: DECK_CENTER_X - rowWidth / 2 + index * (CARD.width + GAP), y: ROW_Y };
  const deck = { x: PLAYER_DECK_FRAME.x, y: PLAYER_DECK_FRAME.y };

  useLayoutEffect(() => {
    const options = { delay: index * 70, easing: 'ease-in-out' } as const;
    if (stage === 1) {
      // The deck splits: each pile leaves the deck for its place in the row.
      group.current?.animate(
        [{ transform: at(deck.x, deck.y, 1 / SHRINK) }, { transform: at(slot.x, slot.y) }],
        { ...options, duration: 450, fill: 'backwards' },
      );
    } else if (stage === 2) {
      // An Epidemic card slides onto the pile, which is then shuffled (a little bounce).
      epidemic.current?.animate(
        [
          { opacity: 0, transform: 'translateY(-46px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { ...options, duration: 350, fill: 'backwards' },
      );
      group.current?.animate(
        [
          { transform: at(slot.x, slot.y) },
          { transform: at(slot.x, slot.y - 8), offset: 0.3 },
          { transform: at(slot.x, slot.y), offset: 0.55 },
          { transform: at(slot.x, slot.y - 5), offset: 0.75 },
          { transform: at(slot.x, slot.y) },
        ],
        { duration: 400, delay: index * 70 + 300, easing: 'ease-in-out' },
      );
    } else {
      // The piles are stacked back into the deck.
      group.current?.animate(
        [
          { transform: at(slot.x, slot.y), opacity: 1 },
          { transform: at(deck.x, deck.y, 1 / SHRINK), opacity: 1, offset: 0.85 },
          { transform: at(deck.x, deck.y, 1 / SHRINK), opacity: 0 },
        ],
        { ...options, duration: 550, fill: 'forwards' },
      );
    }
    // Each stage plays once; the geometry only depends on the pile's place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  return (
    <g ref={group} style={{ transform: at(slot.x, slot.y), transformOrigin: '0 0' }}>
      {[2, 1, 0].map((depth) => (
        <image
          key={depth}
          href={playerBackUrl()}
          x={depth * 1.5}
          y={depth * -1.5}
          width={CARD.width}
          height={CARD.height}
        />
      ))}
      {stage >= 2 && (
        <g ref={epidemic}>
          <image href={epidemicCardUrl()} width={CARD.width} height={CARD.height} />
        </g>
      )}
    </g>
  );
}

/**
 * The player deck being built (the end of the deal): the cards left after the hands split into
 * one pile per Epidemic card (`stage` 1), an Epidemic card shuffled into each (2), the piles
 * stacked back (3). Card backs only; it reveals nothing. Draw it as a child of the map's <svg>.
 */
export function DeckBuild({ epidemics, stage }: { epidemics: number; stage: 1 | 2 | 3 }) {
  return (
    <g data-deck-build={stage} pointerEvents="none" aria-hidden="true">
      {Array.from({ length: epidemics }, (_, index) => (
        <MiniPile key={index} index={index} count={epidemics} stage={stage} />
      ))}
    </g>
  );
}
