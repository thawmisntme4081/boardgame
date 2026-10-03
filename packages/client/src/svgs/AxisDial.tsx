import { AXIS_LIMIT } from '@sky/shared';
import { useTranslation } from 'react-i18next';
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

const ZONES: { position: number; color: string }[] = [
  { position: -3, color: 'stroke-danger' },
  { position: -2, color: 'stroke-amber-400' },
  { position: -1, color: 'stroke-amber-400' },
  { position: 0, color: 'stroke-emerald-600' },
  { position: 1, color: 'stroke-amber-400' },
  { position: 2, color: 'stroke-amber-400' },
  { position: 3, color: 'stroke-danger' },
];
const BAND_R = 86;
const ZONE_GAP = 0.03;

function arc(from: number, to: number, radius: number): string {
  const [x1, y1] = dialPoint(from, radius);
  const [x2, y2] = dialPoint(to, radius);
  return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
}

const signed = (p: number) => (p > 0 ? `+${p}` : p < 0 ? `−${-p}` : '0');

/**
 * The axis dial. `turn`: the positions the current approach space allows when the track
 * advances, drawn like the approach track's turn mark (bigger), floating over the dial's top
 * (absolute, so the panel layout does not move).
 */
export function AxisDial({ axis, turn }: { axis: number; turn?: readonly number[] | null }) {
  const { t } = useTranslation();
  const needleAngle = Math.max(-AXIS_LIMIT, Math.min(AXIS_LIMIT, axis)) * MARK_ANGLE;
  const level = axis === 0;

  return (
    <div className="relative w-full max-w-56">
      {turn && (
        <p
          role="note"
          aria-label={t('tracks.axisTurn', { positions: turn.map(signed).join(t('slot.or')) })}
          className="absolute -top-4 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2"
        >
          {TURN_POSITIONS.map((p) => (
            <span
              key={p}
              aria-hidden="true"
              className={cn(
                'size-3 rounded-full',
                // Allowed: green when level, yellow when tilted (as on the dial); else red.
                !turn.includes(p) ? 'bg-red-600' : p === 0 ? 'bg-green-600' : 'bg-amber-400',
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
            ? t('tracks.axisLevel')
            : t(axis < 0 ? 'tracks.axisTiltedPilot' : 'tracks.axisTiltedCopilot', {
                count: Math.abs(axis),
              })
        }
      >
        {ZONES.map(({ position, color }) => (
          <path
            key={position}
            d={arc(position - 0.5 + ZONE_GAP, position + 0.5 - ZONE_GAP, BAND_R)}
            strokeWidth="10"
            className={cn('fill-none', color)}
          />
        ))}
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="34"
          strokeWidth="5"
          strokeLinecap="round"
          style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: '100px 100px' }}
          className="stroke-foreground transition-transform duration-700 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
        />
        <circle cx="100" cy="100" r="7" className="fill-foreground" />
      </svg>
    </div>
  );
}
