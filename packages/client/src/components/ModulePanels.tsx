// Panels for the Flight Log modules; the rules live in @sky/shared.
import {
  ALARMS,
  alarmPool,
  KEROSENE_START,
  modulesOf,
  WIND_REVERSED_START,
  windSpeed,
  type PlayerView,
  type SlotId,
} from '@sky/shared';
import { BellRing, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { InternBadge } from '@/svgs/InternBadge';
import { WindRing } from '@/svgs/WindRing';
import { Panel } from './Panel';
import { Slot } from './Slot';

/**
 * The kerosene track. When fuel burns, the bar slides down and a red "−N" floats up and fades
 * (keyed per drop, so each burn replays it).
 */
function KeroseneGauge({ kerosene }: { kerosene: number }) {
  const { t } = useTranslation();
  const low = kerosene <= 6;
  // The last value seen and how much the latest burn took (state from the previous render).
  const [seen, setSeen] = useState({ value: kerosene, drop: 0, burns: 0 });
  if (kerosene !== seen.value) {
    setSeen({ value: kerosene, drop: seen.value - kerosene, burns: seen.burns + 1 });
  }
  return (
    <div className="relative flex min-w-0 flex-1 flex-col gap-1">
      {seen.drop > 0 && (
        <span
          key={seen.burns}
          aria-hidden="true"
          className="pointer-events-none absolute -top-4 right-0 animate-[kerosene-burn_1.4s_ease-out_forwards] text-sm font-bold text-danger"
        >
          −{seen.drop}
        </span>
      )}
      <div
        role="meter"
        aria-label={t('modules.kerosene')}
        aria-valuemin={0}
        aria-valuemax={KEROSENE_START}
        aria-valuenow={kerosene}
        className="h-3 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width,background-color] duration-700 ease-out',
            low ? 'bg-danger' : 'bg-light-on',
          )}
          style={{ width: `${(kerosene / KEROSENE_START) * 100}%` }}
        />
      </div>
      <p className={cn('text-xs tabular-nums', low && 'font-semibold text-danger')}>
        {t('modules.keroseneLeft', { left: kerosene, total: KEROSENE_START })}
        {kerosene === 0 && t('modules.keroseneEmpty')}
      </p>
    </div>
  );
}

export function KerosenePanel({ view, leak }: { view: PlayerView; leak: boolean }) {
  const { t } = useTranslation();
  return (
    <Panel
      title={leak ? t('modules.keroseneLeak') : t('modules.kerosene')}
      hint={leak ? t('modules.keroseneLeakHint') : t('modules.keroseneHint')}
    >
      <div className="flex items-center gap-3">
        {!leak && <Slot slot="kerosene" view={view} />}
        <KeroseneGauge kerosene={view.kerosene ?? 0} />
      </div>
    </Panel>
  );
}

/** Wind: shown with the axis (see Cockpit), since the axis turns the ring. */
export function WindPanel({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  return (
    <Panel title={t('modules.wind')} hint={t('modules.windHint')}>
      {/* Desktop: the ring fills the height left in the panel (set by the Axis panel beside it). */}
      <div className="flex justify-center desktop:relative desktop:min-h-28 desktop:flex-1">
        <WindRing
          wind={view.wind ?? 0}
          start={view.scenario.modules.includes('wind-reversed') ? WIND_REVERSED_START : 0}
          className="size-44 desktop:absolute desktop:inset-0 desktop:size-full"
        />
      </div>
    </Panel>
  );
}

/** "+N wind" floating over the speed gauge (absolute, like the turn dots over the axis dial). */
export function WindOnEngines({ wind }: { wind: number }) {
  const { t } = useTranslation();
  const speed = windSpeed(wind);
  return (
    <p
      role="note"
      aria-label={t('modules.windLabel', { speed: speed > 0 ? `+${speed}` : speed })}
      className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-card px-2 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums shadow-sm"
    >
      {t('modules.windOnEngines', { speed: speed > 0 ? `+${speed}` : speed })}
    </p>
  );
}

/**
 * Between two intern tokens: the pilot takes from the left (blue, pointing right) and the
 * co-pilot from the right (orange, pointing left), as on the Intern board.
 */
function InternArrows() {
  return (
    <li aria-hidden="true" className="flex w-3 flex-col items-center justify-center">
      <ChevronRight strokeWidth={3} className="-my-0.5 size-4 shrink-0 text-pilot" />
      <ChevronLeft strokeWidth={3} className="-my-0.5 size-4 shrink-0 text-copilot" />
    </li>
  );
}

export function InternPanel({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  const tokens = view.intern ?? [];
  return (
    <Panel title={t('modules.intern')} hint={t('modules.internHint')}>
      <div className="flex items-center gap-1">
        <Slot slot="internPilot" view={view} />
        <ol
          className="flex min-w-0 flex-1 items-center justify-center gap-1"
          aria-label={
            tokens.length > 0
              ? t('modules.internLeft', { tokens: tokens.join(', ') })
              : t('modules.internTrained')
          }
        >
          {tokens.map((value, i) => (
            <Fragment key={value}>
              {i > 0 && <InternArrows />}
              <li className={cn(i > 0 && i < tokens.length - 1 && 'opacity-70')}>
                <InternBadge value={value} className="h-11" />
              </li>
            </Fragment>
          ))}
          {tokens.length === 0 && (
            <li className="text-xs text-muted-foreground">{t('modules.trained')}</li>
          )}
        </ol>
        <Slot slot="internCopilot" view={view} />
      </div>
    </Panel>
  );
}

const ICE_COLUMNS: [SlotId, SlotId][] = [
  ['ice2Top', 'ice2Bottom'],
  ['ice3Top', 'ice3Bottom'],
  ['ice4Top', 'ice4Bottom'],
  ['ice5Top', 'ice5Bottom'],
];

/** Ice brakes: a column of two dice per value, left to right; the marker must pass the 5. */
export function IceBrakesPanel({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  const cell = (node: ReactNode, key: string) => (
    <div key={key} className="flex justify-center">
      {node}
    </div>
  );
  return (
    <Panel
      title={t('modules.iceBrakes')}
      hint={t('modules.iceBrakesHint')}
      className="justify-between"
    >
      <div className="grid grid-cols-[repeat(7,auto)] items-center justify-start gap-x-1 gap-y-1">
        {ICE_COLUMNS.map(([top], i) => (
          <Fragment key={top}>
            {i > 0 && <span aria-hidden="true" />}
            {cell(<Slot slot={top} view={view} />, top)}
          </Fragment>
        ))}
        {ICE_COLUMNS.map(([top], i) => (
          <Fragment key={`${top}-marker`}>
            {i > 0 && <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />}
            {cell(
              <span
                role="img"
                aria-label={t(view.brakes > i ? 'cockpit.deployed' : 'cockpit.notDeployed', {
                  label: t('modules.iceBrake', { n: i + 2 }),
                })}
                className="h-2 w-10 overflow-hidden rounded-full bg-muted-foreground/25"
              >
                {/* The green fills in from the left when the pair is complete. */}
                <span
                  className={cn(
                    'block h-full origin-left rounded-full bg-light-on transition-transform duration-700 ease-out',
                    view.brakes > i ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </span>,
              `m${i}`,
            )}
          </Fragment>
        ))}
        {ICE_COLUMNS.map(([top, bottom], i) => (
          <Fragment key={bottom}>
            {i > 0 && <span aria-hidden="true" />}
            {cell(<Slot slot={bottom} view={view} />, `${top}-b`)}
          </Fragment>
        ))}
      </div>
    </Panel>
  );
}

const TOKEN = 'grid size-12 shrink-0 place-items-center rounded-xl border-2';

/**
 * The Alarm board: sounding tokens (each a space for the die that clears it, named after the
 * Action it blocks), then the face-down ones (which is which stays unknown until they flip),
 * then the cleared ones.
 */
export function AlarmsPanel({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  const board = view.alarms;
  if (!board) return null;
  const cleared = alarmPool(modulesOf(view.scenario)).filter(
    (id) => !board.active.includes(id) && !board.faceDown.includes(id),
  );
  return (
    <Panel title={t('alarms.title')} hint={t('alarms.hint')}>
      <ul
        className="flex flex-wrap items-start gap-2"
        aria-label={t('alarms.board', {
          active: board.active.length,
          faceDown: board.faceDown.length,
        })}
      >
        {board.active.map((id) => (
          <li key={id} className="flex w-14 flex-col items-center gap-1 text-center">
            <span className="relative">
              <Slot slot={ALARMS[id].slot} view={view} />
              <BellRing
                aria-hidden="true"
                className="absolute -top-2 -left-2 size-5 animate-pulse rounded-full bg-danger p-0.5 text-white"
              />
            </span>
            <span className="text-[11px] leading-tight font-medium text-danger">
              {t(`alarms.name.${id}`)}
            </span>
          </li>
        ))}
        {board.faceDown.map((id, i) => (
          <li key={`down-${i}`} className="flex w-12 flex-col items-center">
            <span
              role="img"
              aria-label={t('alarms.faceDown')}
              className={cn(TOKEN, 'border-danger/30 bg-danger/10 text-danger/50')}
            >
              <BellRing aria-hidden="true" className="size-5" />
            </span>
          </li>
        ))}
        {cleared.map((id) => (
          <li key={id} className="flex w-12 flex-col items-center">
            <span
              role="img"
              aria-label={t('alarms.cleared', { alarm: t(`alarms.name.${id}`) })}
              className={cn(TOKEN, 'border-light-on/50 bg-light-on/10 text-light-on')}
            >
              <Check aria-hidden="true" className="size-5" />
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
