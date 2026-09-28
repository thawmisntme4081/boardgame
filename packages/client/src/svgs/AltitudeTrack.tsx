import type { PlayerView } from '@sky/shared';
import { cn } from '@/lib/utils';

/** Each space is a 3:4 card; wide enough for "6000" with a little padding. */
const CARD_W = 48;
const CARD_H = (CARD_W * 4) / 3;
const GAP = 4;
const CELL = CARD_W + GAP;
const HEIGHT = CARD_H + GAP;

/** Altitude track: current altitude, who plays first each round, reroll tokens still to collect. */
export function AltitudeTrack({ view }: { view: PlayerView }) {
  const spaces = view.scenario.altitudes;
  const current = view.round - 1;
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 truncate text-xs font-medium text-muted-foreground">
        Altitude ({view.altitude} ft)
      </figcaption>
      <svg
        viewBox={`0 0 ${spaces.length * CELL} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Altitude ${view.altitude} feet, round ${view.round} of ${spaces.length}`}
      >
        {spaces.map((space, i) => {
          const x = i * CELL;
          const isCurrent = i === current;
          return (
            <g key={space.altitude} opacity={i < current ? 0.35 : 1}>
              <rect
                x={x + GAP / 2}
                y={GAP / 2}
                width={CARD_W}
                height={CARD_H}
                rx="6"
                strokeWidth={isCurrent ? 3 : 1}
                className={cn('fill-card', isCurrent ? 'stroke-foreground' : 'stroke-border')}
              />
              <path
                d={`M ${x + 8} 8 h 10 l -5 7 z`}
                className={space.first === 'pilot' ? 'fill-pilot' : 'fill-copilot'}
              />
              {space.reroll && i > current && (
                <text
                  x={x + CELL - 11}
                  y="17"
                  textAnchor="middle"
                  className="fill-foreground text-[12px]"
                >
                  ↻
                </text>
              )}
              <text
                x={x + CELL / 2}
                y={GAP / 2 + CARD_H * 0.7}
                textAnchor="middle"
                className="fill-foreground text-[12px] font-semibold"
              >
                {space.altitude === 0 ? '✈' : space.altitude}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
