import type { PlayerView } from '@sky/shared';
import { cn } from '@/lib/utils';
import { Plane } from './Plane';

const CELL = 40;
/** Planes drawn per space; more show as "+N". */
const SHOWN = 3;
const MOTION = 'motion-reduce:transition-none';

/**
 * Approach track: planes on each space, your position, the airport at the end.
 * Drawn in layers so the position marker is one piece that slides along the spaces when
 * the engines move the plane, and planes cleared by the radio fly up and fade out (they
 * stay in the SVG, hidden, rather than being removed).
 */
export function ApproachTrack({ view, radioTarget }: { view: PlayerView; radioTarget?: number }) {
  const planes = view.approachPlanes;
  const airport = planes.length - 1;
  const passed = (i: number) => i < view.approachIndex;
  const fade = (i: number) =>
    cn('transition-opacity duration-500', MOTION, passed(i) && 'opacity-30');

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
        {planes.map((_, i) => (
          <g key={i} className={fade(i)}>
            <rect
              x={i * CELL + 2}
              y="2"
              width={CELL - 4}
              height="46"
              rx="6"
              strokeWidth="1"
              className={cn(i === airport ? 'fill-light-on/20' : 'fill-card', 'stroke-border')}
            />
            {i === airport && (
              <rect
                x={i * CELL + CELL / 2 - 3}
                y="6"
                width="6"
                height="38"
                rx="1"
                className="fill-muted-foreground/40"
              />
            )}
          </g>
        ))}

        <g
          style={{ transform: `translateX(${view.approachIndex * CELL}px)` }}
          className={cn('transition-transform duration-700 ease-in-out', MOTION)}
        >
          <rect
            x="2"
            y="2"
            width={CELL - 4}
            height="46"
            rx="6"
            strokeWidth="3"
            className="fill-none stroke-pilot"
          />
          <path d={`M ${CELL / 2} 52 l -7 10 h 14 z`} className="fill-pilot" />
        </g>

        {radioTarget !== undefined && (
          <rect
            x={radioTarget * CELL + 2}
            y="2"
            width={CELL - 4}
            height="46"
            rx="6"
            strokeWidth="3"
            strokeDasharray="5 3"
            className="fill-none stroke-light-on"
          />
        )}

        {planes.map((count, i) => (
          <g key={i} className={fade(i)}>
            {Array.from({ length: SHOWN }, (_, k) => (
              <g
                key={k}
                className={cn(
                  'transition-[opacity,translate] duration-500 ease-out',
                  MOTION,
                  k >= count && '-translate-y-3 opacity-0',
                )}
              >
                <Plane x={i * CELL + CELL / 2} y={14 + k * 12} />
              </g>
            ))}
            {count > SHOWN && (
              <text
                x={i * CELL + CELL - 6}
                y="46"
                textAnchor="end"
                className="fill-foreground text-[10px]"
              >
                +{count - SHOWN}
              </text>
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}
