import type { PlayerView } from '@sky/rules';
import { EyeOff, PlaneLanding, Waves } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber, t as translate } from '../i18n';
import { trackWidth } from '../lib/trackRow';
import { cn } from '@platform/ui/utils';

/** Each space is a 3:4 card; wide enough for "6000" with a little padding. */
const CARD_W = 48;
const CARD_H = (CARD_W * 4) / 3;
const GAP = 4;
const CELL = CARD_W + GAP;
const HEIGHT = CARD_H + GAP;
const LANDING_ICON = 18;
const WEATHER_ICON = 11;

/** "Turbulence and Bad visibility", or '' for a calm altitude. */
function weatherText(space: { turbulence?: boolean; badVisibility?: boolean }): string {
  return [
    space.turbulence && translate('weather.turbulence'),
    space.badVisibility && translate('weather.badVisibility'),
  ]
    .filter(Boolean)
    .join(translate('slot.and'));
}

export function AltitudeTrack({ view }: { view: PlayerView }) {
  const { t } = useTranslation('sky-team');
  const spaces = view.scenario.altitudes;
  const current = view.round - 1;
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 truncate text-xs font-medium text-muted-foreground">
        {t('tracks.altitude', { altitude: formatNumber(view.altitude) })}
      </figcaption>
      <svg
        viewBox={`0 0 ${spaces.length * CELL} ${HEIGHT}`}
        style={{ width: trackWidth(spaces.length) }}
        role="img"
        aria-label={
          t('tracks.altitudeLabel', {
            altitude: formatNumber(view.altitude),
            round: view.round,
            rounds: spaces.length,
          }) +
          spaces
            .filter((space) => weatherText(space))
            .map(
              (space) =>
                '. ' +
                t('weather.altitudeWeather', {
                  altitude: formatNumber(space.altitude),
                  weather: weatherText(space),
                }),
            )
            .join('')
        }
      >
        {spaces.map((space, i) => {
          const x = i * CELL;
          return (
            <g
              key={space.altitude}
              className={cn('transition-opacity duration-500', i < current && 'opacity-35')}
            >
              <rect
                x={x + GAP / 2}
                y={GAP / 2}
                width={CARD_W}
                height={CARD_H}
                rx="6"
                strokeWidth="1"
                className="fill-card stroke-border"
              />
              <path
                d={`M ${x + 8} 8 h 10 l -5 7 z`}
                className={space.first === 'pilot' ? 'fill-pilot' : 'fill-copilot'}
              />
              {space.reroll && (
                <text
                  x={x + CELL - 11}
                  y="17"
                  textAnchor="middle"
                  className={cn(
                    'fill-foreground text-[12px] transition-[opacity,translate] duration-500 ease-out',
                    i <= current && '-translate-y-2 opacity-0',
                  )}
                >
                  ↻
                </text>
              )}
              {/* Weather on this altitude (Turbulence tracks A–D). */}
              {(space.turbulence || space.badVisibility) && (
                <g className="text-danger">
                  <title>{weatherText(space)}</title>
                  {[space.turbulence && Waves, space.badVisibility && EyeOff]
                    .filter((Icon) => Icon !== false && Icon !== undefined)
                    .map((Icon, k, all) => {
                      const Shape = Icon as typeof Waves;
                      const start = x + CELL / 2 - (all.length * (WEATHER_ICON + 2)) / 2 + 1;
                      return (
                        <Shape
                          key={k}
                          aria-hidden="true"
                          x={start + k * (WEATHER_ICON + 2)}
                          y={GAP / 2 + CARD_H - WEATHER_ICON - 5}
                          size={WEATHER_ICON}
                          strokeWidth={2.5}
                        />
                      );
                    })}
                </g>
              )}
              {space.altitude === 0 ? (
                <PlaneLanding
                  aria-hidden="true"
                  x={x + CELL / 2 - LANDING_ICON / 2}
                  y={GAP / 2 + CARD_H * 0.7 - 4 - LANDING_ICON / 2}
                  size={LANDING_ICON}
                  className="text-foreground"
                />
              ) : (
                <text
                  x={x + CELL / 2}
                  y={GAP / 2 + CARD_H * 0.7}
                  textAnchor="middle"
                  className="fill-foreground text-[12px] font-semibold"
                >
                  {space.altitude}
                </text>
              )}
            </g>
          );
        })}
        <rect
          x={GAP / 2}
          y={GAP / 2}
          width={CARD_W}
          height={CARD_H}
          rx="6"
          strokeWidth="3"
          style={{ transform: `translateX(${current * CELL}px)` }}
          className={cn(
            'fill-none stroke-foreground transition-transform duration-700 ease-in-out',
          )}
        />
      </svg>
    </figure>
  );
}
