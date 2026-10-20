import type { HandCard } from '@pandemic/rules';
import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../svgs/Card';
import { handFace, useCardText, sortHand } from '../lib/cards';
import { usePandemic } from '../store';
import { EventInfo } from './EventInfo';
import { type HandLayout } from '../lib/handLayout';
import { MAP_HEIGHT, PLAYER_DECK_FRAME, PLAYER_DISCARD_FRAME } from '../lib/mapGeometry';

/** How long a card takes to fly in from the deck, or out to the discard pile. */
export const HAND_FLIGHT_MS = 500;

interface Point {
  x: number;
  y: number;
}

const cardKey = (card: HandCard): string =>
  card.kind === 'city' ? `city-${card.city}` : `event-${card.event}`;

const slot = (L: HandLayout, index: number): Point => ({
  x: L.left + (index % L.columns) * (L.cardWidth + L.gap),
  y: L.mapGap + Math.floor(index / L.columns) * (L.cardHeight + L.gap),
});

/** A frame's corner and the scale of a hand card shrunk to it, in the hand group's coordinates. */
const fromFrame = (L: HandLayout, frame: { x: number; y: number; width: number }) => ({
  point: { x: frame.x, y: frame.y - MAP_HEIGHT },
  scale: frame.width / L.cardWidth,
});

const at = ({ x, y }: Point, scale = 1) => `translate(${x}px, ${y}px) scale(${scale})`;

/** One card in its slot. A card that is new to the hand flies in from the player deck. */
function HandCardImage({
  card,
  index,
  enter,
  layout,
  onPick,
}: {
  card: HandCard;
  index: number;
  enter: boolean;
  layout: HandLayout;
  /** The card can be picked (to discard it): it is outlined and a click picks it. */
  onPick?: () => void;
}) {
  const { t } = useTranslation('pandemic');
  const cardText = useCardText();
  const setHoverCity = usePandemic((s) => s.setHoverCity);
  // The pointer on a city card points out the city on the map; on an event card, its text opens.
  const target = (
    <div
      className={`size-full rounded ${onPick ? 'cursor-pointer ring-4 ring-red-500' : ''}`}
      role={onPick ? 'button' : undefined}
      aria-label={onPick ? t('discard.button', { card: cardText(card) }) : undefined}
      onPointerEnter={() => card.kind === 'city' && setHoverCity(card.city)}
      onPointerLeave={() => setHoverCity(null)}
      onClick={onPick}
    />
  );
  const group = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    if (!enter) return;
    const deck = fromFrame(layout, PLAYER_DECK_FRAME);
    group.current?.animate(
      [
        { transform: at(deck.point, deck.scale), opacity: 0.4 },
        { transform: at(slot(layout, index)), opacity: 1 },
      ],
      { duration: HAND_FLIGHT_MS, easing: 'ease-out' },
    );
    // Only on arrival: a card that stays and changes slot slides by the CSS transition instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <g
      ref={group}
      style={{
        transform: at(slot(layout, index)),
        transformOrigin: '0 0',
        transition: `transform ${HAND_FLIGHT_MS / 2}ms ease`,
      }}
    >
      <Card
        face={handFace(card)}
        role="img"
        aria-label={cardText(card)}
        title={cardText(card)}
        width={layout.cardWidth}
        height={layout.cardHeight}
      />
      <foreignObject width={layout.cardWidth} height={layout.cardHeight}>
        {card.kind === 'event' ? <EventInfo event={card.event}>{target}</EventInfo> : target}
      </foreignObject>
    </g>
  );
}

interface Leaving {
  id: number;
  card: HandCard;
  index: number;
  /** Discarded cards fly to the pile; a card given to a partner just fades out. */
  discarded: boolean;
}

/** A card that left the hand, on its way out. Not part of the hand: aria-hidden. */
function LeavingCard({
  leaving,
  layout,
  onDone,
}: {
  leaving: Leaving;
  layout: HandLayout;
  onDone: (id: number) => void;
}) {
  const group = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    const { id, index, discarded } = leaving;
    const discard = fromFrame(layout, PLAYER_DISCARD_FRAME);
    group.current?.animate(
      [
        { transform: at(slot(layout, index)), opacity: 1 },
        discarded
          ? { transform: at(discard.point, discard.scale), opacity: 1 }
          : { transform: at(slot(layout, index)), opacity: 0 },
      ],
      { duration: HAND_FLIGHT_MS, easing: 'ease-in', fill: 'forwards' },
    );
    const timer = setTimeout(() => onDone(id), HAND_FLIGHT_MS);
    return () => clearTimeout(timer);
    // Only the first time: the card is fixed once it starts leaving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <g
      ref={group}
      aria-hidden="true"
      pointerEvents="none"
      style={{ transform: at(slot(layout, leaving.index)), transformOrigin: '0 0' }}
    >
      <Card face={handFace(leaving.card)} width={layout.cardWidth} height={layout.cardHeight} />
    </g>
  );
}

/**
 * Your own hand as card pictures in the map's SVG (a group placed below the map). A card that
 * joins the hand flies in from the player deck; one that leaves flies to the discard pile
 * (`discard` says which are there) or fades out, so the first hand you see is drawn without
 * any animation.
 */
export function HandCards({
  cards,
  discard,
  layout,
  onPick,
}: {
  cards: readonly HandCard[];
  discard: readonly HandCard[];
  layout: HandLayout;
  /** Over the hand limit: a click on a card discards it. */
  onPick?: (card: HandCard) => void;
}) {
  const { t } = useTranslation('pandemic');
  const sorted = sortHand(cards);
  const [leaving, setLeaving] = useState<Leaving[]>([]);
  // What the hand held at the last change, and which cards are new since then (set while
  // rendering, the way React asks for state derived from a change in props).
  const keys = sorted.map(cardKey).join('|');
  const [seen, setSeen] = useState<{
    keys: string;
    entries: { card: HandCard; index: number }[];
    fresh: ReadonlySet<string>;
    leftCount: number;
  } | null>(null);
  if (!seen || seen.keys !== keys) {
    const entries = sorted.map((card, index) => ({ card, index }));
    if (!seen) {
      setSeen({ keys, entries, fresh: new Set(), leftCount: 0 });
    } else {
      const was = new Set(seen.entries.map(({ card }) => cardKey(card)));
      const now = new Set(sorted.map(cardKey));
      const gone = seen.entries.filter(({ card }) => !now.has(cardKey(card)));
      const pile = new Set(discard.map(cardKey));
      if (gone.length > 0) {
        setLeaving((list) => [
          ...list,
          ...gone.map(({ card, index }, n) => ({
            id: seen.leftCount + n,
            card,
            index,
            discarded: pile.has(cardKey(card)),
          })),
        ]);
      }
      setSeen({
        keys,
        entries,
        fresh: new Set([...now].filter((key) => !was.has(key))),
        leftCount: seen.leftCount + gone.length,
      });
    }
  }

  return (
    <g role="group" aria-label={t('hands.title')}>
      {sorted.map((card, i) => (
        <HandCardImage
          key={cardKey(card)}
          card={card}
          index={i}
          layout={layout}
          enter={seen?.fresh.has(cardKey(card)) ?? false}
          onPick={onPick && (() => onPick(card))}
        />
      ))}
      {leaving.map((entry) => (
        <LeavingCard
          key={entry.id}
          leaving={entry}
          layout={layout}
          onDone={(id) => setLeaving((list) => list.filter((item) => item.id !== id))}
        />
      ))}
    </g>
  );
}
