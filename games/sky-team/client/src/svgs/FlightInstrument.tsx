import {
  approachSteps,
  AXIS_LIMIT,
  brakeThreshold,
  brakeThresholds,
  type PlayerView,
} from '@sky/rules';
import { useTranslation } from 'react-i18next';
import { cn } from '@platform/ui/utils';
import { arc as arcAround, polar } from './geometry';

/**
 * Axis and Engines in one round instrument. Upper half: the axis dial (7 parts, the needle
 * turns one part per mark). Lower half: the speed, one segment per value 2..12, left to right
 * under the centre, coloured by how far the plane would fly (stay / 1 space / 2 spaces);
 * the gaps after the blue and orange aerodynamics markers take the marker's colour. The
 * speed is a black dot on its value. Outside the lower band, red sections show the brakes
 * deployed (normal brakes: up to 2, 4, 6; Ice brakes: up to 2, 3, 4, 5).
 */

/** Centre and radius of the dial (a 300×300 drawing). */
const C = 150;
const R = 104;
/** The drawing cropped to the dial: from above the axis ring to below the brakes. */
const VIEW_BOX = '0 32 300 248';
/** Ring widths: axis zones, speed segments, brake sections. */
const AXIS_WIDTH = 14;
const SPEED_WIDTH = 20;
const BRAKE_WIDTH = 6;
/** The brakes ring, just outside the speed segments. */
const BRAKE_R = R + 17;
/** Half the gap between two axis zones, and between two speed segments, in degrees. */
const AXIS_GAP = 1.1;
const SPEED_GAP = 0.8;
/** How far the needle's tip stays inside the axis ring. */
const NEEDLE_INSET = 22;
const NEEDLE_WIDTH = 5;
const HUB_R = 7;
const SPEED_DOT_R = 8;

/** Degrees per axis mark: the 7 parts (-3..3) fill the upper half exactly. */
const MARK_ANGLE = 180 / 7;
const SPEED_MIN = 2;
const SPEED_MAX = 12;
const SPEED_VALUES = Array.from({ length: SPEED_MAX - SPEED_MIN + 1 }, (_, i) => SPEED_MIN + i);

const point = (deg: number, r: number) => polar(C, deg, r);
const arc = (a0: number, a1: number, r: number) => arcAround(C, a0, a1, r);
/** The lower half: 2 (left, under the horizon) to 12 (right). */
const speedAngle = (v: number) => 180 - ((v - SPEED_MIN + 0.5) / (SPEED_MAX - SPEED_MIN + 1)) * 180;
/** Axis position -3..3 to degrees on the upper half (-90 = straight up). */
const axisAngle = (position: number) => -90 + position * MARK_ANGLE;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const AXIS_ZONES = [
  'stroke-danger',
  'stroke-amber-400',
  'stroke-amber-400',
  'stroke-emerald-600',
  'stroke-amber-400',
  'stroke-amber-400',
  'stroke-danger',
];
/** Speed segments by how many approach spaces that speed flies: 0, 1 or 2. */
const SPEED_BANDS = [
  'stroke-zinc-300 dark:stroke-zinc-600',
  'stroke-blue-300 dark:stroke-blue-800',
  'stroke-orange-300 dark:stroke-orange-800',
] as const;
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

/** The current approach space's turn: dots over the dial, green / amber allowed, red not. */
function TurnDots({ turn }: { turn: readonly number[] }) {
  const { t } = useTranslation('sky-team');
  return (
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
  );
}

/** The 11 speed segments, the aerodynamics markers, the numbers and the speed dot. */
function SpeedBand({ view }: { view: PlayerView }) {
  const speed = view.speed === null ? null : clamp(view.speed, SPEED_MIN, SPEED_MAX);
  const markers = [
    { at: view.aeroBlue + 0.5, color: 'stroke-pilot' },
    { at: view.aeroOrange + 0.5, color: 'stroke-copilot' },
  ].filter(({ at }) => at > SPEED_MIN - 0.5 && at < SPEED_MAX + 0.5);
  return (
    <g>
      {SPEED_VALUES.map((v) => (
        <path
          key={v}
          d={arc(speedAngle(v - 0.5) - SPEED_GAP, speedAngle(v + 0.5) + SPEED_GAP, R)}
          strokeWidth={SPEED_WIDTH}
          className={cn(
            'fill-none transition-[stroke] duration-500',
            SPEED_BANDS[approachSteps(v, view.aeroBlue, view.aeroOrange)],
          )}
        />
      ))}
      {/* The aerodynamics markers: the gap after a band's last value, in colour. Drawn
          at angle 0 and turned into place, so a deployed gear or flap slides it along. */}
      {markers.map(({ at, color }) => (
        <path
          key={color}
          d={arc(SPEED_GAP, -SPEED_GAP, R)}
          strokeWidth={SPEED_WIDTH}
          style={turnTo(speedAngle(at))}
          className={cn('fill-none', color, SLIDE)}
        />
      ))}
      {SPEED_VALUES.map((v) => {
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
            <circle r={SPEED_DOT_R} className="fill-foreground" />
            <text y="4" textAnchor="middle" className="fill-background text-[11px] font-semibold">
              {view.speed}
            </text>
          </g>
        </g>
      </g>
    </g>
  );
}

/** One section per brake outside the speed band, filling in red from the left when deployed. */
function BrakeSections({ view }: { view: PlayerView }) {
  const thresholds = brakeThresholds(view.scenario.modules);
  return thresholds.slice(1).map((limit, i) => {
    const d = arc(
      speedAngle(thresholds[i]! + 0.5) - SPEED_GAP,
      speedAngle(limit + 0.5) + SPEED_GAP,
      BRAKE_R,
    );
    return (
      <g key={limit}>
        <path d={d} strokeWidth={BRAKE_WIDTH} className="fill-none stroke-muted" />
        <path
          d={d}
          strokeWidth={BRAKE_WIDTH}
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={i < view.brakes ? 0 : 1}
          className="fill-none stroke-danger transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </g>
    );
  });
}

export function FlightInstrument({
  view,
  turn,
  className,
}: {
  view: PlayerView;
  /** The current approach space's turn, shown as dots over the dial (absent: none). */
  turn?: readonly number[] | null;
  className?: string;
}) {
  const { t } = useTranslation('sky-team');
  const needle = clamp(view.axis, -AXIS_LIMIT, AXIS_LIMIT) * MARK_ANGLE;
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
    brake: brakeThreshold(view.brakes, view.scenario.modules),
  });

  return (
    <div className={cn('relative w-full max-w-96', className)}>
      {turn && <TurnDots turn={turn} />}
      <svg
        viewBox={VIEW_BOX}
        className="w-full"
        role="img"
        aria-label={`${axisLabel}. ${speedLabel}`}
      >
        {/* Axis: 7 parts over the top. */}
        {AXIS_ZONES.map((color, i) => (
          <path
            key={i}
            d={arc(axisAngle(i - 3.5) + AXIS_GAP, axisAngle(i - 2.5) - AXIS_GAP, R)}
            strokeWidth={AXIS_WIDTH}
            className={cn('fill-none', color)}
          />
        ))}
        <SpeedBand view={view} />
        <BrakeSections view={view} />
        <line
          x1={C}
          y1={C}
          x2={C}
          y2={C - R + NEEDLE_INSET}
          strokeWidth={NEEDLE_WIDTH}
          strokeLinecap="round"
          style={{ transform: `rotate(${needle}deg)`, transformOrigin: `${C}px ${C}px` }}
          className="stroke-foreground transition-transform duration-700 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
        />
        <circle cx={C} cy={C} r={HUB_R} className="fill-foreground" />
      </svg>
    </div>
  );
}
