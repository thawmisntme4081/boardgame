import type { PlayerView, Seat, SlotId } from '@sky/shared';
import { ChevronDown, ChevronRight, Coffee } from 'lucide-react';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { AeroMarkerIcon } from '@/svgs/AeroMarker';
import { BrakeMarkerIcon } from '@/svgs/BrakeMarker';
import { FlightInstrument } from '@/svgs/FlightInstrument';
import { Switch } from '@/svgs/Switch';
import {
  AlarmsPanel,
  IceBrakesPanel,
  InternPanel,
  KerosenePanel,
  WindOnEngines,
  WindPanel,
} from './ModulePanels';
import { Panel } from './Panel';
import { Slot } from './Slot';

type Section =
  | 'wind'
  | 'instrument'
  | 'gear'
  | 'flaps'
  | 'radio'
  | 'brakes'
  | 'concentration'
  | 'kerosene'
  | 'intern'
  | 'alarms';

/**
 * Top to bottom below desktop, per seat: your own systems first. Brakes: the pilot's, so near
 * the top for the pilot; for the co-pilot the Ice brakes (whose bottom row they can fill) come
 * after the flaps, the normal brakes go last. Desktop ignores this order (see `desktopGrid`).
 */
function sectionOrder(seat: Seat, ice: boolean): Section[] {
  if (seat === 'pilot') {
    return [
      'wind',
      'instrument',
      'alarms',
      'gear',
      'brakes',
      'kerosene',
      'intern',
      'radio',
      'concentration',
      'flaps',
    ];
  }
  return [
    'wind',
    'instrument',
    'alarms',
    'radio',
    'concentration',
    'flaps',
    ...(ice ? (['brakes'] as const) : []),
    'kerosene',
    'intern',
    'gear',
    ...(ice ? [] : (['brakes'] as const)),
  ];
}

/**
 * The desktop grid, built from the panels in play. Landing gear left and Flaps right share
 * the top row, so they always have the same height. Axis & Engines spans the top two rows,
 * with Wind and Radio stacked beside it (Radio alone when there is no Wind). Brakes and
 * Concentration split the centre below. Kerosene and Intern each get a full-height column
 * left of Flaps. Alarms take a row of their own under the centre.
 */
function desktopGrid(shown: readonly Section[]): CSSProperties {
  const has = (s: Section) => shown.includes(s);
  const mods = [...(has('kerosene') ? ['kerosene'] : []), ...(has('intern') ? ['intern'] : [])];
  const row = (...cells: string[]) => `'${cells.join(' ')}'`;
  if (!has('wind')) {
    // No Wind: Radio is a narrow column (its spaces stacked). The centre is 1fr · R · 1fr · R,
    // R the Radio width: Axis & Engines spans the first three, Radio the last, and Brakes and
    // Concentration take 1fr + R each, so they match and fill the width of the two above.
    const rows = [
      row('gear', 'instrument', 'instrument', 'instrument', 'radio', ...mods, 'flaps'),
      row('.', 'instrument', 'instrument', 'instrument', 'radio', ...mods, '.'),
      row('.', 'brakes', 'brakes', 'concentration', 'concentration', ...mods, '.'),
      ...(has('alarms')
        ? [row('.', 'alarms', 'alarms', 'alarms', 'alarms', ...mods.map(() => '.'), '.')]
        : []),
    ];
    const radio = '5.5rem';
    const columns = [
      '13%',
      'minmax(0, 1fr)',
      radio,
      'minmax(0, 1fr)',
      radio,
      ...mods.map(() => '7rem'),
      '13%',
    ];
    return {
      '--cockpit-areas': rows.join(' '),
      '--cockpit-columns': columns.join(' '),
    } as CSSProperties;
  }
  const rows = [
    row(
      'gear',
      'instrument',
      'instrument',
      'instrument',
      has('wind') ? 'wind' : 'radio',
      ...mods,
      'flaps',
    ),
    row('.', 'instrument', 'instrument', 'instrument', 'radio', ...mods, '.'),
    row('.', 'brakes', 'brakes', 'concentration', 'concentration', ...mods, '.'),
    ...(has('alarms')
      ? [row('.', 'alarms', 'alarms', 'alarms', 'alarms', ...mods.map(() => '.'), '.')]
      : []),
  ];
  const columns = ['13%', 'repeat(4, minmax(0, 1fr))', ...mods.map(() => '7rem'), '13%'];
  return {
    '--cockpit-areas': rows.join(' '),
    '--cockpit-columns': columns.join(' '),
  } as CSSProperties;
}

/** Below desktop every panel takes the full width, so the per-seat order reads top to bottom. */
const SPAN = 'max-desktop:col-span-2';
/** Phones: these two share a row instead of each taking the full width. */
const HALF: Partial<Record<Section, string>> = {
  radio: 'max-desktop:col-span-1',
  concentration: 'max-desktop:col-span-1',
};

/** The pilot's radio space and the co-pilot's two. */
const RADIO_GROUPS: SlotId[][] = [['radioPilot'], ['radioCopilot1', 'radioCopilot2']];

const AREA: Record<Section, string> = {
  wind: 'desktop:[grid-area:wind]',
  instrument: 'desktop:[grid-area:instrument]',
  radio: 'desktop:[grid-area:radio]',
  brakes: 'desktop:[grid-area:brakes]',
  concentration: 'desktop:[grid-area:concentration]',
  gear: 'desktop:[grid-area:gear]',
  flaps: 'desktop:[grid-area:flaps]',
  kerosene: 'desktop:[grid-area:kerosene]',
  intern: 'desktop:[grid-area:intern]',
  alarms: 'desktop:[grid-area:alarms]',
};

/** Arrow between ordered spaces: right in a row, down in a desktop column (under the slot). */
function OrderArrow({ column }: { column: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-11 items-center text-muted-foreground desktop:h-12',
        column && 'desktop:h-4 desktop:w-12 desktop:justify-center',
      )}
    >
      <ChevronRight className={cn('size-4', column && 'desktop:hidden')} />
      {column && <ChevronDown className="hidden size-4 desktop:block" />}
    </span>
  );
}

function Slots({
  ids,
  view,
  switches,
  column,
  ordered,
  className,
}: {
  ids: SlotId[];
  view: PlayerView;
  switches?: boolean[];
  /**
   * Desktop: slots in a column, with each switch on this side of its slot. The column
   * hugs the panel's outer edge: left for `switch-right`, right for `switch-left`.
   */
  column?: 'switch-left' | 'switch-right';
  /** Draw arrows between spaces that must be filled in order. */
  ordered?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'flex flex-wrap items-end',
        // Ordered spaces sit tight around their arrows (brakes, flaps).
        ordered ? 'gap-0' : 'gap-2',
        column && 'desktop:flex-col',
        column === 'switch-right' && 'desktop:items-start',
        column === 'switch-left' && 'desktop:items-end',
        column && (ordered ? 'desktop:gap-0' : 'desktop:gap-5'),
        className,
      )}
    >
      {ids.map((id, i) => (
        <Fragment key={id}>
          {ordered && i > 0 && <OrderArrow column={column !== undefined} />}
          <div
            className={cn(
              'flex flex-col items-center gap-1',
              column === 'switch-left' && 'desktop:flex-row desktop:gap-2',
              column === 'switch-right' && 'desktop:flex-row-reverse desktop:gap-2',
            )}
          >
            {switches && <Switch on={switches[i]!} label={t('cockpit.switch', { n: i + 1 })} />}
            <Slot slot={id} view={view} />
          </div>
        </Fragment>
      ))}
    </div>
  );
}

export function Cockpit({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  const modules = view.scenario.modules;
  const ice = modules.includes('ice-brakes');
  const leak = modules.includes('kerosene-leak');
  // Engines out (TER): the Engine spaces are covered (grey X) and there is no speed.
  const engines = !modules.includes('engines-out');
  const shown = sectionOrder(view.seat, ice).filter(
    (id) =>
      (id !== 'wind' || view.wind !== null) &&
      (id !== 'kerosene' || leak || modules.includes('kerosene')) &&
      (id !== 'intern' || modules.includes('intern')) &&
      (id !== 'alarms' || view.alarms !== null),
  );
  const slotLabel = (text: string) => (
    <span className="text-[11px] text-muted-foreground">{text}</span>
  );
  const sections: Record<Section, ReactNode> = {
    wind: <WindPanel view={view} />,
    kerosene: <KerosenePanel view={view} leak={leak} />,
    intern: <InternPanel view={view} />,
    alarms: <AlarmsPanel view={view} />,
    instrument: (
      <Panel
        title={t('cockpit.axisEngines')}
        mandatory
        hint={[
          t('cockpit.axisHint'),
          engines &&
            (view.finalRound
              ? t('cockpit.enginesFinal')
              : view.wind !== null
                ? t('cockpit.enginesWind')
                : t('cockpit.enginesHint')),
        ]
          .filter(Boolean)
          .join(' · ')}
      >
        {/* Axis spaces at the top corners, Engine spaces at the bottom ones. */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-2">
          <div className="flex flex-col items-center justify-between">
            <div className="flex flex-col items-center gap-1">
              <Slot slot="axisPilot" view={view} />
              {slotLabel(t('cockpit.axis'))}
            </div>
            <div className="flex flex-col items-center gap-1">
              <Slot slot="enginePilot" view={view} />
              {slotLabel(t('cockpit.engines'))}
            </div>
          </div>
          <div className="relative flex items-center justify-center">
            <FlightInstrument
              view={view}
              // Turns only matter while the track can still advance.
              turn={view.finalRound ? null : view.scenario.turns?.[view.approachIndex]}
            />
            {engines && view.wind !== null && (
              <div className="absolute inset-x-0 top-[68%]">
                <WindOnEngines wind={view.wind} />
              </div>
            )}
          </div>
          <div className="flex flex-col items-center justify-between">
            <div className="flex flex-col items-center gap-1">
              <Slot slot="axisCopilot" view={view} />
              {slotLabel(t('cockpit.axis'))}
            </div>
            <div className="flex flex-col items-center gap-1">
              <Slot slot="engineCopilot" view={view} />
              {slotLabel(t('cockpit.engines'))}
            </div>
          </div>
        </div>
      </Panel>
    ),
    // One Radio panel: the co-pilot's two spaces above the pilot's (on desktop without Wind,
    // all three in one column).
    radio: (
      <Panel title={t('cockpit.radio')} hint={t('cockpit.radioHint')}>
        {/*
          Your own radio spaces first, then a separator, then your partner's. Phones: one row.
          Desktop: stacked; without Wind, one column (each group too) with the separator.
        */}
        <div
          className={cn(
            'flex items-center gap-1.5 desktop:flex-col desktop:items-start desktop:gap-2',
            view.wind === null && 'desktop:flex-1 desktop:items-center desktop:[&>div]:flex-col',
          )}
        >
          {(view.seat === 'pilot' ? RADIO_GROUPS : [...RADIO_GROUPS].reverse()).map((ids, i) => (
            <Fragment key={ids[0]}>
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-11 w-px shrink-0 bg-border desktop:h-12',
                    view.wind === null ? 'desktop:h-px desktop:w-12' : 'desktop:hidden',
                  )}
                />
              )}
              <Slots ids={ids} view={view} />
            </Fragment>
          ))}
        </div>
      </Panel>
    ),
    gear: (
      <Panel
        title={t('cockpit.landingGear')}
        badge={
          <span className="inline-flex items-center gap-1">
            <AeroMarkerIcon marker="blue" />
            <span className="sr-only">{t('cockpit.blueMarker')}</span> +1
          </span>
        }
        side
      >
        <Slots
          ids={['gear1', 'gear2', 'gear3']}
          view={view}
          switches={view.gear}
          column="switch-right"
        />
      </Panel>
    ),
    flaps: (
      <Panel
        title={t('cockpit.flaps')}
        badge={
          <span className="inline-flex items-center gap-1">
            <AeroMarkerIcon marker="orange" />
            <span className="sr-only">{t('cockpit.orangeMarker')}</span> +1
          </span>
        }
        side
      >
        <Slots
          ids={['flaps1', 'flaps2', 'flaps3', 'flaps4']}
          view={view}
          switches={view.flaps}
          column="switch-left"
          ordered
        />
      </Panel>
    ),
    brakes: ice ? (
      <IceBrakesPanel view={view} />
    ) : (
      <Panel
        title={t('cockpit.brakes')}
        badge={
          <span className="inline-flex items-center gap-1">
            <BrakeMarkerIcon />
            <span className="sr-only">{t('cockpit.brakeMarker')}</span> +2
          </span>
        }
        className="justify-between"
      >
        <Slots
          ids={['brakes1', 'brakes2', 'brakes3']}
          view={view}
          switches={[0, 1, 2].map((i) => view.brakes > i)}
          ordered
        />
      </Panel>
    ),
    concentration: (
      <Panel
        title={t('cockpit.concentration')}
        hint={t('cockpit.concentrationHint')}
        className="justify-between"
      >
        <div className="flex items-center justify-between gap-2 max-desktop:flex-col max-desktop:items-start">
          <Slots
            ids={['concentration1', 'concentration2', 'concentration3']}
            view={view}
            className="max-desktop:gap-1.5"
          />
          <p
            className="flex items-center gap-1"
            aria-label={t('cockpit.coffeeCount', { count: view.coffee })}
          >
            {[0, 1, 2].map((i) => (
              <Coffee
                key={i}
                aria-hidden="true"
                className={
                  i < view.coffee ? 'size-5 text-foreground' : 'size-5 text-muted-foreground/30'
                }
              />
            ))}
          </p>
        </div>
      </Panel>
    ),
  };

  return (
    <div className="@container">
      <div
        className="cockpit-grid grid grid-cols-[auto_minmax(0,1fr)] gap-2 desktop:gap-3"
        style={desktopGrid(shown)}
      >
        {shown.map((id) => (
          <div key={id} className={cn(HALF[id] ?? SPAN, AREA[id])}>
            {sections[id]}
          </div>
        ))}
      </div>
    </div>
  );
}
