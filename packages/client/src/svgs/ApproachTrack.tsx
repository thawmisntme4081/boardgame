import type { PlayerView } from '@sky/shared';
import { cn } from '@/lib/utils';
import { Plane } from './Plane';

const CELL = 40;

/** Approach track: planes on each space, your position, the airport at the end. */
export function ApproachTrack({ view, radioTarget }: { view: PlayerView; radioTarget?: number }) {
  const planes = view.approachPlanes;
  const airport = planes.length - 1;
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 truncate text-xs font-medium text-muted-foreground">
        Approach · {view.scenario.name}
      </figcaption>
      <svg
        viewBox={`0 0 ${planes.length * CELL} 64`}
        className="w-full"
        role="img"
        aria-label={`Approach: ${airport - view.approachIndex} spaces to the airport. Planes per space from here: ${planes.slice(view.approachIndex).join(', ')}`}
      >
        {planes.map((count, i) => {
          const x = i * CELL;
          const here = i === view.approachIndex;
          const target = i === radioTarget;
          return (
            <g key={i} opacity={i < view.approachIndex ? 0.3 : 1}>
              <rect
                x={x + 2}
                y="2"
                width={CELL - 4}
                height="46"
                rx="6"
                strokeWidth={here || target ? 3 : 1}
                strokeDasharray={target ? '5 3' : undefined}
                className={cn(
                  i === airport ? 'fill-light-on/20' : 'fill-card',
                  target ? 'stroke-light-on' : here ? 'stroke-pilot' : 'stroke-border',
                )}
              />
              {i === airport && (
                <rect
                  x={x + CELL / 2 - 3}
                  y="6"
                  width="6"
                  height="38"
                  rx="1"
                  className="fill-muted-foreground/40"
                />
              )}
              {Array.from({ length: Math.min(count, 3) }, (_, k) => (
                <Plane key={k} x={x + CELL / 2} y={14 + k * 12} />
              ))}
              {count > 3 && (
                <text
                  x={x + CELL - 6}
                  y="46"
                  textAnchor="end"
                  className="fill-foreground text-[10px]"
                >
                  +{count - 3}
                </text>
              )}
              {here && <path d={`M ${x + CELL / 2} 52 l -7 10 h 14 z`} className="fill-pilot" />}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
