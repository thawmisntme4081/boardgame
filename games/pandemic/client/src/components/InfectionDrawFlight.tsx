import type { CityId } from '@pandemic/rules';
import { useLayoutEffect, useRef } from 'react';
import { infectionBackUrl, infectionCardUrl } from '../lib/cardImages';
import { INFECTION_DECK_FRAME, INFECTION_DISCARD_FRAME } from '../lib/mapGeometry';

/** How long one card's flight from the deck to the discard pile takes. */
export const INFECTION_DRAW_MS = 550;

const { width: W, height: H } = INFECTION_DECK_FRAME;
const FROM = { x: INFECTION_DECK_FRAME.x, y: INFECTION_DECK_FRAME.y };
const TO = { x: INFECTION_DISCARD_FRAME.x, y: INFECTION_DISCARD_FRAME.y };
const MID = { x: (FROM.x + TO.x) / 2, y: (FROM.y + TO.y) / 2 };

const at = (x: number, y: number, scaleX: number) => `translate(${x}px, ${y}px) scaleX(${scaleX})`;

/**
 * One infection card flying from the deck to the discard pile in a straight line, with a flip
 * (the back shrinks to a sliver, the city's face grows back out) halfway there. Draw it as a
 * child of the map's <svg>, in map coordinates.
 */
export function InfectionDrawFlight({ city }: { city: CityId }) {
  const group = useRef<SVGGElement>(null);
  const back = useRef<SVGImageElement>(null);
  const face = useRef<SVGImageElement>(null);

  useLayoutEffect(() => {
    group.current?.animate(
      [
        { transform: at(FROM.x, FROM.y, 1) },
        { transform: at(MID.x, MID.y, 0.05), offset: 0.5 },
        { transform: at(TO.x, TO.y, 1) },
      ],
      { duration: INFECTION_DRAW_MS, easing: 'ease-in-out', fill: 'forwards' },
    );
    back.current?.animate(
      [{ opacity: 1 }, { opacity: 1, offset: 0.49 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }],
      { duration: INFECTION_DRAW_MS, fill: 'forwards' },
    );
    face.current?.animate(
      [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 0.51 }, { opacity: 1 }],
      { duration: INFECTION_DRAW_MS, fill: 'forwards' },
    );
  }, [city]);

  return (
    <g
      ref={group}
      style={{ transform: at(FROM.x, FROM.y, 1), transformOrigin: `${W / 2}px ${H / 2}px` }}
    >
      <image ref={back} href={infectionBackUrl()} width={W} height={H} />
      <image ref={face} href={infectionCardUrl(city)} width={W} height={H} opacity={0} />
    </g>
  );
}
