import { WIND_RING, windSpeed } from '@sky/shared';
import { cn } from '@/lib/utils';

const C = 60;
const R = 44;

const point = (index: number, radius: number) => {
  // Index 0 (the white centre space) at the top, then clockwise.
  const angle = ((index * 360) / WIND_RING.length - 90) * (Math.PI / 180);
  return { x: C + radius * Math.cos(angle), y: C + radius * Math.sin(angle) };
};

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** The Wind Ring: the blue airplane points at the wind speed added to the engines. */
export function WindRing({ wind }: { wind: number }) {
  const nose = point(wind, R - 16);
  const speed = windSpeed(wind);
  return (
    <svg
      viewBox="0 0 120 120"
      className="size-28 shrink-0"
      role="img"
      aria-label={`Wind ${signed(speed)} added to the engines`}
    >
      <circle cx={C} cy={C} r={R + 10} className="fill-muted" />
      {WIND_RING.map((value, i) => {
        const { x, y } = point(i, R);
        const current = i === wind;
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r="9"
              className={cn(
                current ? 'fill-pilot' : i === 0 ? 'fill-card' : 'fill-background',
                'stroke-border',
              )}
            />
            <text
              x={x}
              y={y + 3.5}
              textAnchor="middle"
              className={cn(
                'text-[10px] font-semibold',
                current ? 'fill-white' : 'fill-foreground',
              )}
            >
              {signed(value)}
            </text>
          </g>
        );
      })}
      <line
        x1={C}
        y1={C}
        x2={nose.x}
        y2={nose.y}
        strokeWidth="5"
        strokeLinecap="round"
        className="stroke-pilot"
      />
      <circle cx={C} cy={C} r="6" className="fill-pilot" />
    </svg>
  );
}
