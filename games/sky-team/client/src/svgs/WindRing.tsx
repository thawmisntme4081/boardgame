import { WIND_RING, windSpeed } from '@sky/rules';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@platform/ui/utils';
import { polar } from './geometry';

const C = 60;
const R = 48;
/** Space markers as big as the ring allows for its number of spaces (20 today). */
const SPOT = Math.min(9, (Math.PI * R) / WIND_RING.length - 0.5);

/** `index` places from the top (0), clockwise. */
const point = (index: number, radius: number) => {
  const [x, y] = polar(C, (index * 360) / WIND_RING.length - 90, radius);
  return { x, y };
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

/**
 * The Wind Ring: the blue airplane points at the wind speed added to the engines. `start`
 * is the airplane's starting space (white), drawn at the top: 0, or the opposite space when
 * the module is placed upside down.
 */
export function WindRing({
  wind,
  start = 0,
  className,
}: {
  wind: number;
  start?: number;
  className?: string;
}) {
  const nose = point(0, R - 16);
  const angle = useNeedleAngle(wind - start);
  const speed = windSpeed(wind);
  const { t } = useTranslation('sky-team');
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn('size-28 shrink-0', className)}
      role="img"
      aria-label={t('modules.windLabel', { speed: signed(speed) })}
    >
      <circle cx={C} cy={C} r={R + SPOT + 2} className="fill-muted" />
      {WIND_RING.map((value, i) => {
        const { x, y } = point(i - start, R);
        const current = i === wind;
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r={SPOT}
              className={cn(
                'transition-[fill] duration-500',
                current ? 'fill-pilot' : i === start ? 'fill-card' : 'fill-background',
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
      {/* Drawn pointing at the center space, then turned: the turn animates. */}
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
