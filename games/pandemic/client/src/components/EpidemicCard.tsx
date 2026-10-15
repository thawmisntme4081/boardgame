import { useLayoutEffect, useRef } from 'react';
import { epidemicCardUrl } from '../lib/cardImages';
import { PLAYER_DECK_FRAME, PLAYER_DISCARD_FRAME } from '../lib/mapGeometry';

const FLIGHT_MS = 600;
const at = (x: number, y: number, scale: number) => `translate(${x}px, ${y}px) scale(${scale})`;

/**
 * The Epidemic card just drawn, shown on the player card pile with a pulsing highlight for as
 * long as the epidemic is being resolved: it flies in from the player deck when it appears.
 * Draw it as a child of the map's <svg>, in map coordinates.
 */
export function EpidemicCard({ count }: { count: number }) {
  const group = useRef<SVGGElement>(null);
  const to = PLAYER_DISCARD_FRAME;
  useLayoutEffect(() => {
    group.current?.animate(
      [
        {
          transform: at(
            PLAYER_DECK_FRAME.x,
            PLAYER_DECK_FRAME.y,
            PLAYER_DECK_FRAME.width / to.width,
          ),
        },
        { transform: at(to.x, to.y, 1) },
      ],
      { duration: FLIGHT_MS, easing: 'ease-out', fill: 'backwards' },
    );
    // Only when the card appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <g data-epidemic-card pointerEvents="none">
      <g ref={group} style={{ transform: at(to.x, to.y, 1), transformOrigin: '0 0' }}>
        <image href={epidemicCardUrl()} width={to.width} height={to.height} />
        <rect
          className="epidemic-glow"
          width={to.width}
          height={to.height}
          rx={4}
          fill="none"
          stroke="oklch(0.85 0.17 95)"
          strokeWidth={4}
        />
      </g>
      {count > 1 && (
        <text
          x={to.x + to.width - 4}
          y={to.y + to.height - 5}
          textAnchor="end"
          fontSize={15}
          fill="white"
          stroke="black"
          strokeWidth={2.5}
          paintOrder="stroke"
          fontWeight={700}
        >
          {count}
        </text>
      )}
    </g>
  );
}
