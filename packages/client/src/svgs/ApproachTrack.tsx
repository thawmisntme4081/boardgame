import type { PlayerView } from '@sky/shared';
import { BellRing, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { t } from '@/i18n';
import { trackWidth } from '@/lib/trackRow';
import { cn } from '@/lib/utils';
import { DIFFICULTY_DOT } from '@/scenarioText';
import { Plane } from './Plane';

const CELL = 40;
/** Planes drawn per space; more show as "+N". */
const SHOWN = 3;
/** Axis positions left to right as the players see them: the pilot sits on the left. */
const TURN_POSITIONS = [-2, -1, 0, 1, 2];

/** "axis must be 2 toward the pilot or level" */
const turnText = (allowed: readonly number[]) =>
  t('tracks.turnMustBe', {
    positions: allowed
      .map((p) =>
        p === 0
          ? t('tracks.turnLevel')
          : t(p < 0 ? 'tracks.turnTowardPilot' : 'tracks.turnTowardCopilot', {
              count: Math.abs(p),
            }),
      )
      .join(t('slot.or')),
  });

/** Traffic die icons: a black die, times the number of rolls. */
function Traffic({ x, y, count }: { x: number; y: number; count: number }) {
  return (
    <g>
      <title>{t('tracks.trafficTitle', { count })}</title>
      <rect x={x} y={y} width="9" height="9" rx="2" className="fill-neutral-900" />
      <circle cx={x + 4.5} cy={y + 4.5} r="1.6" className="fill-white" />
      {count > 1 && (
        <text x={x + 11} y={y + 8} className="fill-foreground text-[8px]">
          ×{count}
        </text>
      )}
    </g>
  );
}

/** Turn: the axis positions allowed when flying out of this space. */
function Turn({ cx, y, allowed }: { cx: number; y: number; allowed: readonly number[] }) {
  return (
    <g>
      <title>{t('tracks.turnTitle', { text: turnText(allowed) })}</title>
      {TURN_POSITIONS.map((p, k) => (
        <circle
          key={p}
          cx={cx + (k - 2) * 4}
          cy={y}
          r="1.6"
          strokeWidth="0.8"
          className={
            // Allowed: green when level, yellow when tilted (as on the axis dial); else red.
            !allowed.includes(p)
              ? 'fill-red-600 stroke-red-600'
              : p === 0
                ? 'fill-green-600 stroke-green-600'
                : 'fill-amber-400 stroke-amber-400'
          }
        />
      ))}
    </g>
  );
}

/**
 * Approach track: planes on each space, traffic and turns, your position, the airport.
 * Drawn in layers so the position marker is one piece that slides along the spaces when
 * the engines move the plane, and planes cleared by the radio fly up and fade out (they
 * stay in the SVG, hidden, rather than being removed).
 */
export function ApproachTrack({ view, radioTarget }: { view: PlayerView; radioTarget?: number }) {
  const { t } = useTranslation();
  const { scenario } = view;
  const planes = view.approachPlanes;
  const airport = planes.length - 1;
  const here = view.approachIndex;
  const passed = (i: number) => i < here;
  const fade = (i: number) => cn('transition-opacity duration-500', passed(i) && 'opacity-30');
  const effects = Boolean(scenario.traffic?.some(Boolean) || scenario.turns?.some(Boolean));
  const rowY = 51;
  // A space with both traffic and a turn stacks them: traffic die above, turn dots below.
  const stacked = planes.some((_, i) => (scenario.traffic?.[i] ?? 0) > 0 && scenario.turns?.[i]);
  const height = effects ? (stacked ? 72 : 64) : 50;
  const hereTraffic = scenario.traffic?.[here] ?? 0;
  // Strategy phase: how many planes the traffic dice just added to each space.
  const addedPlanes: Record<number, number> = {};
  if (view.phase === 'strategy') {
    for (const { space } of view.traffic) {
      if (space !== null) addedPlanes[space] = (addedPlanes[space] ?? 0) + 1;
    }
  }
  const hereTurn = scenario.turns?.[here];
  const hereAlarms = scenario.alarms?.[here] ?? 0;
  const hereTrust = (scenario.totalTrust?.[here] ?? 0) > 0;
  const hereText = [
    hereTraffic > 0 && t('tracks.hereTraffic', { count: hereTraffic }),
    hereTurn && t('tracks.hereTurn', { text: turnText(hereTurn) }),
    hereAlarms > 0 && t('tracks.hereAlarm', { count: hereAlarms }),
    hereTrust && t('tracks.hereTrust'),
  ]
    .filter(Boolean)
    .join('; ');

  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 flex items-center gap-1.5 truncate text-xs font-medium text-muted-foreground">
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-2 shrink-0 rounded-full',
            DIFFICULTY_DOT[scenario.difficulty],
          )}
        />
        {t('tracks.approach', { name: scenario.name })}
      </figcaption>
      <svg
        viewBox={`0 0 ${planes.length * CELL} ${height}`}
        style={{ width: trackWidth(planes.length) }}
        role="img"
        aria-label={
          t('tracks.approachLabel', {
            spaces: airport - here,
            planes: planes.slice(here).join(', '),
          }) + (hereText ? t('tracks.currentSpace', { text: hereText }) : '')
        }
      >
        {planes.map((_, i) => {
          const x = i * CELL;
          const traffic = scenario.traffic?.[i] ?? 0;
          const turn = scenario.turns?.[i];
          const alarms = scenario.alarms?.[i] ?? 0;
          const trust = (scenario.totalTrust?.[i] ?? 0) > 0;
          return (
            <g key={i} className={fade(i)}>
              <rect
                x={x + 2}
                y="2"
                width={CELL - 4}
                height="46"
                rx="6"
                strokeWidth="1"
                className={cn(i === airport ? 'fill-light-on/20' : 'fill-card', 'stroke-border')}
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
              {/* Alarm (top left) and Total Trust (top right) symbols inside the card. */}
              {alarms > 0 && (
                <g className="text-danger">
                  <title>{t('tracks.alarmTitle', { count: alarms })}</title>
                  <BellRing aria-hidden="true" x={x + 4} y={4} size={9} strokeWidth={2.5} />
                  {alarms > 1 && (
                    <text x={x + 5} y={21} className="fill-danger text-[7px]">
                      ×{alarms}
                    </text>
                  )}
                </g>
              )}
              {trust && (
                <g className="text-foreground">
                  <title>{t('tracks.trustTitle')}</title>
                  <VolumeX aria-hidden="true" x={x + CELL - 13} y={4} size={9} strokeWidth={2.5} />
                </g>
              )}
              {traffic > 0 && <Traffic x={x + 13} y={rowY} count={traffic} />}
              {turn && (
                <Turn cx={x + CELL / 2} y={traffic > 0 ? rowY + 15 : rowY + 4.5} allowed={turn} />
              )}
            </g>
          );
        })}

        <g
          style={{ transform: `translateX(${here * CELL}px)` }}
          className={cn('transition-transform duration-700 ease-in-out')}
        >
          <rect
            x="2"
            y="2"
            width={CELL - 4}
            height="46"
            rx="6"
            strokeWidth="2"
            className={
              view.seat === 'pilot' ? 'fill-none stroke-pilot' : 'fill-none stroke-copilot'
            }
          />
        </g>

        {/* Planes the traffic die just added: marked until the dice are rolled. */}
        {view.phase === 'strategy' &&
          view.traffic.map(({ space }, i) =>
            space === null ? null : (
              <g key={`traffic-${i}`}>
                <title>{t('tracks.addedByTraffic')}</title>
                <rect
                  x={space * CELL + 2}
                  y="2"
                  width={CELL - 4}
                  height="46"
                  rx="6"
                  strokeWidth="2.5"
                  className="animate-pulse fill-none stroke-neutral-900 dark:stroke-neutral-100"
                />
              </g>
            ),
          )}

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
            {Array.from({ length: SHOWN }, (_, k) => {
              // The top planes of a space are the ones the traffic dice just added there.
              const added = k < count && k >= count - (addedPlanes[i] ?? 0);
              return (
                <g
                  key={k}
                  className={cn(
                    'transition-[opacity,translate] duration-500 ease-out',
                    k >= count && '-translate-y-3 opacity-0',
                    added && 'origin-center animate-[drop-in_0.5s_ease-out] transform-fill',
                  )}
                >
                  <Plane
                    x={i * CELL + CELL / 2}
                    y={14 + k * 12}
                    // Dropped in, then pulsing black and light red until the dice are rolled.
                    className={cn(
                      added &&
                        'animate-[traffic-plane_1.2s_ease-in-out_0.5s_infinite] dark:animate-[traffic-plane-dark_1.2s_ease-in-out_0.5s_infinite]',
                    )}
                  />
                </g>
              );
            })}
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
