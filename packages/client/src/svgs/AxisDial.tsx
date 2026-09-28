import { AXIS_LIMIT } from '@sky/shared';

const DEG = Math.PI / 180;
/** Degrees per axis mark on the dial. */
const MARK_ANGLE = 25;

/** Positive axis tilts toward the pilot, drawn on the left as on the real board. */
function dialPoint(position: number, radius: number): [number, number] {
  const angle = -position * MARK_ANGLE * DEG;
  return [100 + radius * Math.sin(angle), 100 - radius * Math.cos(angle)];
}

export function AxisDial({ axis }: { axis: number }) {
  const marks = [];
  for (let p = -AXIS_LIMIT; p <= AXIS_LIMIT; p++) marks.push(p);
  const [nx, ny] = dialPoint(Math.max(-AXIS_LIMIT, Math.min(AXIS_LIMIT, axis)), 70);
  const level = axis === 0;

  return (
    <svg
      viewBox="0 0 200 112"
      className="w-full max-w-56"
      role="img"
      aria-label={
        level
          ? 'Axis level'
          : `Axis tilted ${Math.abs(axis)} toward the ${axis > 0 ? 'pilot' : 'co-pilot'}`
      }
    >
      <path
        d="M 12 100 A 88 88 0 0 1 188 100"
        className="fill-none stroke-muted-foreground/30"
        strokeWidth="2"
      />
      {marks.map((p) => {
        const [x1, y1] = dialPoint(p, 80);
        const [x2, y2] = dialPoint(p, 92);
        const [tx, ty] = dialPoint(p, 86);
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
        x2={nx}
        y2={ny}
        strokeWidth="5"
        strokeLinecap="round"
        className={
          level ? 'stroke-light-on' : Math.abs(axis) >= 2 ? 'stroke-danger' : 'stroke-foreground'
        }
      />
      <circle cx="100" cy="100" r="7" className="fill-foreground" />
    </svg>
  );
}
