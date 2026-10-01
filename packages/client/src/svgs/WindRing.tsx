import { WIND_RING, windSpeed } from '@sky/shared';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const C = 60;
const R = 48;
/** Space markers as big as the ring allows for its number of spaces (20 today). */
const SPOT = Math.min(9, (Math.PI * R) / WIND_RING.length - 0.5);

const point = (index: number, radius: number) => {
  // Index 0 (the white centre space) at the top, then clockwise.
  const angle = ((index * 360) / WIND_RING.length - 90) * (Math.PI / 180);
  return { x: C + radius * Math.cos(angle), y: C + radius * Math.sin(angle) };
};

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

const STEP = 360 / WIND_RING.length;

/**
 * The needle's angle, turning the short way round: kept as a running total so going from
 * the last space to the first (or back) moves one step, not a full turn the other way.
 */
function useNeedleAngle(wind: number): number {
  const [needle, setNeedle] = useState({ wind, angle: wind * STEP });
  if (wind !== needle.wind) {
    const n = WIND_RING.length;
    const steps = ((((wind - needle.wind) % n) + n + n / 2) % n) - n / 2;
    setNeedle({ wind, angle: needle.angle + steps * STEP });
  }
  return needle.angle;
}

/** The Wind Ring: the blue airplane points at the wind speed added to the engines. */
export function WindRing({ wind, className }: { wind: number; className?: string }) {
  const nose = point(0, R - 16);
  const angle = useNeedleAngle(wind);
  const speed = windSpeed(wind);
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn('size-28 shrink-0', className)}
      role="img"
      aria-label={`Wind ${signed(speed)} added to the engines`}
    >
      <circle cx={C} cy={C} r={R + SPOT + 2} className="fill-muted" />
      {WIND_RING.map((value, i) => {
        const { x, y } = point(i, R);
        const current = i === wind;
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r={SPOT}
              className={cn(
                'transition-[fill] duration-500',
                current ? 'fill-pilot' : i === 0 ? 'fill-card' : 'fill-background',
                'stroke-border',
              )}
            />
            <text
              x={x}
              y={y + SPOT * 0.38}
              textAnchor="middle"
              style={{ fontSize: SPOT * 1.05 }}
              className={cn(
                'font-semibold transition-[fill] duration-500',
                current ? 'fill-white' : 'fill-foreground',
              )}
            >
              {signed(value)}
            </text>
          </g>
        );
      })}
      {/* Drawn pointing at the centre space, then turned: the turn animates. */}
      <line
        x1={C}
        y1={C}
        x2={nose.x}
        y2={nose.y}
        strokeWidth="5"
        strokeLinecap="round"
        style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${C}px ${C}px` }}
        className="stroke-pilot transition-transform duration-700 ease-in-out"
      />
      <circle cx={C} cy={C} r="6" className="fill-pilot" />
    </svg>
  );
}
