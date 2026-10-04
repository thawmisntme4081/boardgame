// Short notes in the dice tray: traffic, weather, Total Trust, timers, dice set aside.
import { REAL_TIME_MS, type AltitudeSpace, type PlayerView } from '@sky/shared';
import { EyeOff, VolumeX, Waves } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatClock } from '@/lib/clock';
import { DieFace } from '@/svgs/DieFace';
import { spacesAhead } from './text';

/** The traffic die rolled at the start of the round, and where each plane went. */
export function TrafficNews({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  if (view.traffic.length === 0) return null;
  // Only the black dice on screen; where each plane went stays readable for screen readers.
  const news = view.traffic
    .map(({ roll, space }) =>
      space === null
        ? t('tray.trafficNoPlanes', { roll })
        : t('tray.trafficRolled', { roll, where: spacesAhead(view, space) }),
    )
    .join('; ');
  return (
    <span role="status" aria-label={`${t('tray.traffic')} ${news}`} className="flex gap-1">
      {view.traffic.map(({ roll }, i) => (
        <DieFace key={i} value={roll} seat="pilot" kind="traffic" className="size-8" />
      ))}
    </span>
  );
}

/** Turbulence and Bad Visibility together make a storm. */
const weatherOf = (space: AltitudeSpace) =>
  space.turbulence && space.badVisibility
    ? 'storm'
    : space.turbulence
      ? 'turbulence'
      : 'badVisibility';

/** This altitude's weather (Turbulence tracks A–D): what it does to your dice. */
export function WeatherNote({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  const space = view.scenario.altitudes[view.round - 1];
  if (!space?.turbulence && !space?.badVisibility) return null;
  const Icon = space.turbulence ? Waves : EyeOff;
  return (
    <p className="flex items-start gap-1.5 text-sm font-medium text-danger">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {t(`weather.${weatherOf(space)}Rule`)}
    </p>
  );
}

/** Total Trust: no strategy talk this round; the server rolls when the pause ends. */
export function TotalTrustNote() {
  const { t } = useTranslation();
  return (
    <p className="flex items-start gap-1.5 text-sm font-medium" role="status">
      <VolumeX aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {t('tray.totalTrust')}
    </p>
  );
}

/** The round's time limit: Real-time scenarios, or a timer the creator chose in the lobby. */
export function TimerNote({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  if (view.scenario.modules.includes('real-time')) {
    return (
      <p className="text-sm font-medium">
        {t('tray.realTime', { time: formatClock(REAL_TIME_MS) })}
      </p>
    );
  }
  if (view.timerMs === null) return null;
  return (
    <p className="text-sm font-medium">
      {t('tray.timedGame', { time: formatClock(view.timerMs) })}
    </p>
  );
}

/** Bad Visibility: your dice still set aside, face down until they come in. */
export function SetAsideDice({ count }: { count: number }) {
  const { t } = useTranslation();
  if (count === 0) return null;
  return (
    <span role="img" aria-label={t('weather.setAside', { count })} className="flex gap-2">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="grid size-12 place-items-center rounded-xl border-2 border-dashed border-muted-foreground/50 bg-muted text-muted-foreground"
        >
          <EyeOff aria-hidden="true" className="size-5" />
        </span>
      ))}
    </span>
  );
}

/** Before take-off: the dice wait for both players to confirm. */
export function SetupNote() {
  const { t } = useTranslation();
  return <p className="text-sm text-muted-foreground">{t('preflight.trayNote')}</p>;
}
