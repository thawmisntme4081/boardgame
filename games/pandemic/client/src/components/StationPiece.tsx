import { useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from '../lib/frames';
import { Station, STATION_HEIGHT, STATION_WIDTH } from '../svgs/Station';

const IN: Keyframe[] = [
  { opacity: 0, transform: 'translateY(-30px) scale(0.7)' },
  { opacity: 1, transform: 'translateY(2px) scale(1.06)', offset: 0.65 },
  { opacity: 1, transform: 'none' },
];
const OUT: Keyframe[] = [
  { opacity: 1, transform: 'none' },
  { opacity: 0, transform: 'translateY(-8px) scale(0.6)' },
];
/** How long a station takes to leave (the page keeps it this long). */
export const STATION_OUT_MS = 250;

/**
 * A research station in the middle of the city at the origin of the group it is drawn in. It
 * drops in when built and shrinks away when `leaving`.
 */
export function StationPiece({ city, leaving }: { city: string; leaving: boolean }) {
  const group = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    group.current?.animate(leaving ? OUT : IN, {
      duration: leaving ? STATION_OUT_MS : 450,
      easing: 'ease-out',
      fill: 'both',
    });
  }, [leaving]);
  return (
    <g ref={group} style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
      <Station data-station={city} x={-STATION_WIDTH / 2} y={-STATION_HEIGHT / 2} />
    </g>
  );
}
