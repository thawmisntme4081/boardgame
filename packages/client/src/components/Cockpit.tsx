import type { PlayerView, Seat, SlotId } from '@sky/shared';
import { ChevronDown, ChevronRight, Coffee } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { AxisDial } from '@/svgs/AxisDial';
import { AeroMarkerIcon } from '@/svgs/AeroMarker';
import { BrakeMarkerIcon } from '@/svgs/BrakeMarker';
import { SpeedGauge } from '@/svgs/SpeedGauge';
import { Switch } from '@/svgs/Switch';
import {
  IceBrakesPanel,
  InternPanel,
  KerosenePanel,
  WindOnEngines,
  WindPanel,
} from './ModulePanels';
import { DESKTOP_PANEL, Panel, PANEL, PanelHeader } from './Panel';
import { Slot } from './Slot';

type Section =
  | 'axis'
  | 'engines'
  | 'gear'
  | 'flaps'
  | 'radio'
  | 'brakes'
  | 'concentration'
  | 'kerosene'
  | 'intern';

/**
 * Top to bottom below desktop, per seat: your own systems first (Wind sits inside the axis
 * section). Brakes: the pilot's, so near the top for the pilot; for the co-pilot the Ice brakes
 * (whose bottom row they can fill) come after the flaps, the normal brakes go last.
 * Desktop ignores this order and places panels by grid area.
 */
function sectionOrder(seat: Seat, ice: boolean): Section[] {
  if (seat === 'pilot') {
    return [
      'axis',
      'engines',
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
    'axis',
    'engines',
    'radio',
    'flaps',
    ...(ice ? (['brakes'] as const) : []),
    'kerosene',
    'intern',
    'concentration',
    'gear',
    ...(ice ? [] : (['brakes'] as const)),
  ];
}

/** Below desktop every panel takes the full width, so the per-seat order reads top to bottom. */
const SPAN = 'max-desktop:col-span-2';

/**
 * Desktop places each panel by name (see `.cockpit-grid`): pilot radio and gear left,
 * co-pilot radio and flaps right. Radio is one panel below desktop; on desktop its wrapper
 * steps aside (`contents`) so its pilot and co-pilot halves take their own areas.
 */
const AREA: Record<Section, string> = {
  axis: 'desktop:[grid-area:axis]',
  engines: 'desktop:[grid-area:engines]',
  radio: 'desktop:contents',
  brakes: 'desktop:[grid-area:brakes]',
  concentration: 'desktop:[grid-area:concentration]',
  gear: 'desktop:[grid-area:gear]',
  flaps: 'desktop:[grid-area:flaps]',
  // Desktop: one row under the control panel, half each.
  kerosene: 'desktop:col-span-2',
  intern: 'desktop:col-span-2',
};

/** Arrow between ordered spaces: right in a row, down in a desktop column (under the slot). */
function OrderArrow({ column }: { column: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-12 items-center text-muted-foreground',
        column && 'desktop:h-auto desktop:w-12 desktop:justify-center',
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
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'flex flex-wrap items-end gap-2',
        column && 'desktop:flex-col',
        column === 'switch-right' && 'desktop:items-start',
        column === 'switch-left' && 'desktop:items-end',
        column && (ordered ? 'desktop:gap-1' : 'desktop:gap-5'),
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
  const ice = view.scenario.modules.includes('ice-brakes');
  const modules = view.scenario.modules;
  const leak = modules.includes('kerosene-leak');
  // Engines out (TER): no Engine spaces, so no Engines panel.
  const enginesOut = modules.includes('engines-out');
  const shown = sectionOrder(view.seat, ice).filter(
    (id) =>
      (id !== 'kerosene' || leak || modules.includes('kerosene')) &&
      (id !== 'intern' || modules.includes('intern')) &&
      (id !== 'engines' || !enginesOut),
  );
  const sections: Record<Section, ReactNode> = {
    kerosene: <KerosenePanel view={view} leak={leak} />,
    intern: <InternPanel view={view} />,
    axis: (
      <div className="flex h-full flex-col gap-3 desktop:flex-row">
        {view.wind !== null && (
          <div className="desktop:order-last desktop:w-1/4 desktop:flex-none">
            <WindPanel view={view} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Panel title={t('cockpit.axis')} hint={t('cockpit.axisHint')} mandatory>
            <div className="flex items-center justify-between gap-2">
              <Slot slot="axisPilot" view={view} />
              <AxisDial
                axis={view.axis}
                // Turns only matter while the track can still advance.
                turn={view.finalRound ? null : view.scenario.turns?.[view.approachIndex]}
              />
              <Slot slot="axisCopilot" view={view} />
            </div>
          </Panel>
        </div>
      </div>
    ),
    engines: (
      <Panel
        title={t('cockpit.engines')}
        mandatory
        hint={
          view.finalRound
            ? t('cockpit.enginesFinal')
            : view.wind !== null
              ? t('cockpit.enginesWind')
              : t('cockpit.enginesHint')
        }
      >
        <div className="flex items-center justify-between gap-2 desktop:flex-1">
          <Slot slot="enginePilot" view={view} />
          <div className="relative flex min-w-0 flex-1 justify-center desktop:min-h-24 desktop:self-stretch">
            {view.wind !== null && <WindOnEngines wind={view.wind} />}
            <SpeedGauge
              view={view}
              className="desktop:absolute desktop:inset-0 desktop:size-full desktop:max-w-none"
            />
          </div>
          <Slot slot="engineCopilot" view={view} />
        </div>
      </Panel>
    ),
    radio: (
      <section aria-label={t('cockpit.radio')} className={cn(PANEL, 'desktop:contents')}>
        <PanelHeader
          title={t('cockpit.radio')}
          hint={t('cockpit.radioHint')}
          className="desktop:hidden"
        />
        <div className="flex flex-wrap items-end gap-2 desktop:contents">
          <div className={cn('desktop:[grid-area:radioPilot]', DESKTOP_PANEL)}>
            <PanelHeader
              title={t('cockpit.radio')}
              hint={t('cockpit.radioHint')}
              side
              className="hidden desktop:flex"
            />
            <Slots ids={['radioPilot']} view={view} />
          </div>
          <div className={cn('desktop:[grid-area:radioCopilot]', DESKTOP_PANEL)}>
            <PanelHeader
              title={t('cockpit.radio')}
              hint={t('cockpit.radioHint')}
              side
              className="hidden desktop:flex"
            />
            <Slots ids={['radioCopilot1', 'radioCopilot2']} view={view} />
          </div>
        </div>
      </section>
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
        <div className="flex items-center justify-between gap-2">
          <Slots ids={['concentration1', 'concentration2', 'concentration3']} view={view} />
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
      <div className={cn('cockpit-grid grid grid-cols-2 gap-3', enginesOut && 'no-engines')}>
        {shown.map((id) => (
          <div key={id} className={cn(SPAN, AREA[id])}>
            {sections[id]}
          </div>
        ))}
      </div>
    </div>
  );
}
