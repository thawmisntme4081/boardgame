import { AXIS_LIMIT } from '@sky/shared';
import { cn } from '@/lib/utils';

const DEG = Math.PI / 180;
/** Degrees per axis mark on the dial. */
const MARK_ANGLE = 25;

/** Left to right -2 -1 0 1 2, as the needle turns: negative is toward the pilot. */
function dialPoint(position: number, radius: number): [number, number] {
  const angle = position * MARK_ANGLE * DEG;
  return [100 + radius * Math.sin(angle), 100 - radius * Math.cos(angle)];
}

const TURN_POSITIONS = [-2, -1, 0, 1, 2];

const signed = (p: number) => (p > 0 ? `+${p}` : p < 0 ? `−${-p}` : '0');

/**
 * The axis dial. `turn`: the positions the current approach space allows when the track
 * advances, drawn like the approach track's turn mark (bigger), floating over the dial's top
 * (absolute, so the panel layout does not move).
 */
export function AxisDial({ axis, turn }: { axis: number; turn?: readonly number[] | null }) {
  const marks = [];
  for (let p = -AXIS_LIMIT; p <= AXIS_LIMIT; p++) marks.push(p);
  const needleAngle = Math.max(-AXIS_LIMIT, Math.min(AXIS_LIMIT, axis)) * MARK_ANGLE;
  const level = axis === 0;

  return (
    <div className="relative w-full max-w-56">
      {turn && (
        <p
          role="note"
          aria-label={`Turn: to advance, the axis must be at ${turn.map(signed).join(' or ')}`}
          className="absolute -top-4 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2"
        >
          {TURN_POSITIONS.map((p) => (
            <span
              key={p}
              aria-hidden="true"
              className={cn(
                'size-3 rounded-full',
                turn.includes(p) ? 'bg-green-600' : 'bg-red-600',
              )}
            />
          ))}
        </p>
      )}
      <svg
        viewBox="0 0 200 112"
        className="w-full"
        role="img"
        aria-label={
          level
            ? 'Axis level'
            : `Axis tilted ${Math.abs(axis)} toward the ${axis < 0 ? 'pilot' : 'co-pilot'}`
        }
      >
        <path
          d="M 12 100 A 88 88 0 0 1 188 100"
          className="fill-none stroke-muted-foreground/30"
          strokeWidth="2"
        />
        {marks.map((p) => {
          const [x1, y1] = dialPoint(p, 82);
          const [x2, y2] = dialPoint(p, 94);
          const [tx, ty] = dialPoint(p, 88);
          return Math.abs(p) === AXIS_LIMIT ? (
            <text
              key={p}
              x={tx}
              y={ty + 5}
              textAnchor="middle"
              className="fill-danger text-[16px] font-bold"
            >
              ✕
            </text>
          ) : (
            <line
              key={p}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth={p === 0 ? 4 : 2}
              className={p === 0 ? 'stroke-foreground' : 'stroke-muted-foreground'}
            />
          );
        })}
        <text x="18" y="108" className="fill-pilot text-[12px] font-semibold">
          Pilot
        </text>
        <text x="182" y="108" textAnchor="end" className="fill-copilot text-[12px] font-semibold">
          Co-pilot
        </text>
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="30"
          strokeWidth="5"
          strokeLinecap="round"
          style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: '100px 100px' }}
          className={cn(
            'transition-[transform,stroke] duration-700 ease-[cubic-bezier(0.34,1.4,0.64,1)]',
            level ? 'stroke-light-on' : Math.abs(axis) >= 2 ? 'stroke-danger' : 'stroke-foreground',
          )}
        />
        <circle cx="100" cy="100" r="7" className="fill-foreground" />
      </svg>
    </div>
  );
}
