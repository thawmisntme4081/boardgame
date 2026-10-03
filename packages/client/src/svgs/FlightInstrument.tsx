import { AXIS_LIMIT, BRAKE_THRESHOLDS, MODULES, type PlayerView } from '@sky/shared';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/**
 * Axis and Engines in one round instrument. Upper half: the axis dial (7 parts, the needle
 * turns 25° per mark). Lower half: the speed, one segment per value 2..12, left to right
 * under the centre, coloured by how far the plane would fly (stay / 1 space / 2 spaces);
 * the gaps after the blue and orange aerodynamics markers take the marker's colour. The
 * speed is a black dot on its value. Outside the lower band, red sections show the brakes
 * deployed (normal brakes: up to 2, 4, 6; Ice brakes: up to 2, 3, 4, 5).
 */

const C = 150;
const R = 104;
const DEG = Math.PI / 180;
/** Degrees per axis mark: the 7 parts (-3..3) fill the upper half exactly. */
const MARK_ANGLE = 180 / 7;
const SPEED_MIN = 2;
const SPEED_MAX = 12;
/** The lower half: 2 (left, under the horizon) to 12 (right). */
const speedAngle = (v: number) => 180 - ((v - SPEED_MIN + 0.5) / (SPEED_MAX - SPEED_MIN + 1)) * 180;
/** Half the gap between two engine segments, in degrees. */
const GAP = 0.8;

const point = (deg: number, r: number): [number, number] => [
  C + r * Math.cos(deg * DEG),
  C + r * Math.sin(deg * DEG),
];
/** A circle arc from `a0` to `a1` degrees (0 = right, 90 = down). */
function arc(a0: number, a1: number, r: number): string {
  const [x0, y0] = point(a0, r);
  const [x1, y1] = point(a1, r);
  return `M ${x0} ${y0} A ${r} ${r} 0 0 ${a1 > a0 ? 1 : 0} ${x1} ${y1}`;
}
/** Axis position -3..3 to degrees on the upper half (-90 = straight up). */
const axisAngle = (position: number) => -90 + position * MARK_ANGLE;

const AXIS_ZONES = [
  'stroke-danger',
  'stroke-amber-400',
  'stroke-amber-400',
  'stroke-emerald-600',
  'stroke-amber-400',
  'stroke-amber-400',
  'stroke-danger',
];
const TURN_POSITIONS = [-2, -1, 0, 1, 2];
const SLIDE = 'transition-transform duration-500 ease-out';
/** Turns an element drawn at angle 0 round the centre (or, `own`, round its own centre). */
const turnTo = (deg: number, own = false) =>
  own
    ? {
        transform: `rotate(${deg}deg)`,
        transformBox: 'fill-box' as const,
        transformOrigin: 'center',
      }
    : { transform: `rotate(${deg}deg)`, transformOrigin: `${C}px ${C}px` };
const signed = (p: number) => (p > 0 ? `+${p}` : p < 0 ? `−${-p}` : '0');

export function FlightInstrument({
  view,
  turn,
  engines = true,
  className,
}: {
  view: PlayerView;
  /** The current approach space's turn, shown as dots over the dial (absent: none). */
  turn?: readonly number[] | null;
  /** Engines out (TER): no speed, only the axis and the brakes. */
  engines?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const needle = Math.max(-AXIS_LIMIT, Math.min(AXIS_LIMIT, view.axis)) * MARK_ANGLE;
  const thresholds =
    view.scenario.modules.map((id) => MODULES[id].brakeThresholds).find(Boolean) ??
    BRAKE_THRESHOLDS;
  const speed = view.speed === null ? null : Math.max(SPEED_MIN, Math.min(SPEED_MAX, view.speed));
  const band = (v: number) =>
    v <= view.aeroBlue
      ? 'stroke-zinc-300 dark:stroke-zinc-600'
      : v <= view.aeroOrange
        ? 'stroke-blue-300 dark:stroke-blue-800'
        : 'stroke-orange-300 dark:stroke-orange-800';
  const values = Array.from({ length: SPEED_MAX - SPEED_MIN + 1 }, (_, i) => SPEED_MIN + i);
  const markers = [
    { at: view.aeroBlue + 0.5, color: 'stroke-pilot' },
    { at: view.aeroOrange + 0.5, color: 'stroke-copilot' },
  ].filter(({ at }) => at > SPEED_MIN - 0.5 && at < SPEED_MAX + 0.5);

  const axisLabel =
    view.axis === 0
      ? t('tracks.axisLevel')
      : t(view.axis < 0 ? 'tracks.axisTiltedPilot' : 'tracks.axisTiltedCopilot', {
          count: Math.abs(view.axis),
        });
  const speedLabel = t('tracks.speedLabel', {
    speed: view.speed ?? t('tracks.speedNotSet'),
    blue: Math.ceil(view.aeroBlue + 0.5),
    orange: view.aeroOrange,
    brake: thresholds[Math.min(view.brakes, thresholds.length - 1)],
  });

  return (
    <div className={cn('relative w-full max-w-96', className)}>
      {turn && (
        <p
          role="note"
          aria-label={t('tracks.axisTurn', { positions: turn.map(signed).join(t('slot.or')) })}
          className="absolute -top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2"
        >
          {TURN_POSITIONS.map((p) => (
            <span
              key={p}
              aria-hidden="true"
              className={cn(
                'size-3 rounded-full',
                !turn.includes(p) ? 'bg-red-600' : p === 0 ? 'bg-green-600' : 'bg-amber-400',
              )}
            />
          ))}
        </p>
      )}
      <svg
        viewBox="0 32 300 248"
        className="w-full"
        role="img"
        aria-label={engines ? `${axisLabel}. ${speedLabel}` : axisLabel}
      >
        {/* Axis: 7 parts over the top. */}
        {AXIS_ZONES.map((color, i) => (
          <path
            key={i}
            d={arc(axisAngle(i - 3.5) + 1.1, axisAngle(i - 2.5) - 1.1, R)}
            strokeWidth="14"
            className={cn('fill-none', color)}
          />
        ))}
        {engines && (
          <g>
            {values.map((v) => (
              <path
                key={v}
                d={arc(speedAngle(v - 0.5) - GAP, speedAngle(v + 0.5) + GAP, R)}
                strokeWidth="20"
                className={cn('fill-none transition-[stroke] duration-500', band(v))}
              />
            ))}
            {/* The aerodynamics markers: the gap after a band's last value, in colour. Drawn
                at angle 0 and turned into place, so a deployed gear or flap slides it along. */}
            {markers.map(({ at, color }) => (
              <path
                key={color}
                d={arc(GAP, -GAP, R)}
                strokeWidth="20"
                style={turnTo(speedAngle(at))}
                className={cn('fill-none', color, SLIDE)}
              />
            ))}
            {values.map((v) => {
              const [x, y] = point(speedAngle(v), R);
              return (
                <text
                  key={v}
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  className="fill-foreground text-[11px] font-semibold"
                >
                  {v}
                </text>
              );
            })}
            {/* The speed: a black dot with the number in white, sliding round to its value. */}
            <g
              style={turnTo(speedAngle(speed ?? SPEED_MIN))}
              className={cn(SLIDE, speed === null && 'opacity-0')}
            >
              <g transform={`translate(${C + R} ${C})`}>
                <g style={turnTo(-speedAngle(speed ?? SPEED_MIN), true)} className={SLIDE}>
                  <circle r="8" className="fill-foreground" />
                  <text
                    y="4"
                    textAnchor="middle"
                    className="fill-background text-[11px] font-semibold"
                  >
                    {view.speed}
                  </text>
                </g>
              </g>
            </g>
          </g>
        )}

        {/* Brakes: one section per brake outside the lower band, filling in red from the left
            when that brake is deployed (as the Ice brakes' bars used to). */}
        {thresholds.slice(1).map((limit, i) => {
          const d = arc(
            speedAngle(thresholds[i]! + 0.5) - GAP,
            speedAngle(limit + 0.5) + GAP,
            R + 17,
          );
          return (
            <g key={limit}>
              <path d={d} strokeWidth="6" className="fill-none stroke-muted" />
              <path
                d={d}
                strokeWidth="6"
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={i < view.brakes ? 0 : 1}
                className="fill-none stroke-danger transition-[stroke-dashoffset] duration-700 ease-out"
              />
            </g>
          );
        })}

        <line
          x1={C}
          y1={C}
          x2={C}
          y2={C - R + 22}
          strokeWidth="5"
          strokeLinecap="round"
          style={{ transform: `rotate(${needle}deg)`, transformOrigin: `${C}px ${C}px` }}
          className="stroke-foreground transition-transform duration-700 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
        />
        <circle cx={C} cy={C} r="7" className="fill-foreground" />
      </svg>
    </div>
  );
}
