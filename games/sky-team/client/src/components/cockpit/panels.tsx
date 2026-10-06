// The base game's cockpit panels; module panels are in ModulePanels.tsx.
import { MAX_COFFEE, type PlayerView, type Seat, type SlotId } from '@sky/rules';
import { Coffee } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@platform/ui/utils';
import { AeroMarkerIcon } from '../../svgs/AeroMarker';
import { BrakeMarkerIcon } from '../../svgs/BrakeMarker';
import { FlightInstrument } from '../../svgs/FlightInstrument';
import { Panel } from '../Panel';
import { Slot } from '../Slot';
import { IceBrakesPanel, WindOnEngines } from './ModulePanels';
import { Slots } from './Slots';

const GEAR_SLOTS: SlotId[] = ['gear1', 'gear2', 'gear3'];
const FLAPS_SLOTS: SlotId[] = ['flaps1', 'flaps2', 'flaps3', 'flaps4'];
const BRAKE_SLOTS: SlotId[] = ['brakes1', 'brakes2', 'brakes3'];
const CONCENTRATION_SLOTS: SlotId[] = ['concentration1', 'concentration2', 'concentration3'];
/** The pilot's radio space and the co-pilot's two. */
const RADIO_GROUPS: SlotId[][] = [['radioPilot'], ['radioCopilot1', 'radioCopilot2']];
/** Each seat's Axis and Engine space, at the instrument's left (pilot) and right (co-pilot). */
const INSTRUMENT_SLOTS: Record<Seat, { axis: SlotId; engine: SlotId }> = {
  pilot: { axis: 'axisPilot', engine: 'enginePilot' },
  copilot: { axis: 'axisCopilot', engine: 'engineCopilot' },
};

/** The marker a system moves, after the panel title: icon, name for screen readers, "+N". */
function MarkerBadge({ icon, label, bonus }: { icon: ReactNode; label: string; bonus: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {icon}
      <span className="sr-only">{label}</span> +{bonus}
    </span>
  );
}

/** A space with a small caption under it. */
function LabeledSlot({ slot, label, view }: { slot: SlotId; label: string; view: PlayerView }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Slot slot={slot} view={view} />
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

/** One side of the instrument: the seat's Axis space at the top, its Engine space at the bottom. */
function InstrumentColumn({ seat, view }: { seat: Seat; view: PlayerView }) {
  const { t } = useTranslation('sky-team');
  const { axis, engine } = INSTRUMENT_SLOTS[seat];
  return (
    <div className="flex flex-col items-center justify-between">
      <LabeledSlot slot={axis} label={t('cockpit.axis')} view={view} />
      <LabeledSlot slot={engine} label={t('cockpit.engines')} view={view} />
    </div>
  );
}

/** Axis & Engines: the round instrument between the pilot's spaces and the co-pilot's. */
export function InstrumentPanel({ view }: { view: PlayerView }) {
  const { t } = useTranslation('sky-team');
  // Engines out (TER): the Engine spaces are covered (grey X) and there is no speed.
  const engines = !view.scenario.modules.includes('engines-out');
  const enginesHint = view.finalRound
    ? t('cockpit.enginesFinal')
    : view.wind !== null
      ? t('cockpit.enginesWind')
      : t('cockpit.enginesHint');
  return (
    <Panel
      title={t('cockpit.axisEngines')}
      mandatory
      hint={[t('cockpit.axisHint'), engines && enginesHint].filter(Boolean).join(' · ')}
    >
      {/* Axis spaces at the top corners, Engine spaces at the bottom ones. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-2">
        <InstrumentColumn seat="pilot" view={view} />
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
        <InstrumentColumn seat="copilot" view={view} />
      </div>
    </Panel>
  );
}

/**
 * One Radio panel: your own radio spaces first, then a separator, then your partner's.
 * Phones: one row. Desktop: stacked; without Wind, one column (each group too) with the
 * separator.
 */
export function RadioPanel({ view }: { view: PlayerView }) {
  const { t } = useTranslation('sky-team');
  const groups = view.seat === 'pilot' ? RADIO_GROUPS : [...RADIO_GROUPS].reverse();
  return (
    <Panel title={t('cockpit.radio')} hint={t('cockpit.radioHint')}>
      <div
        className={cn(
          'flex items-center gap-1.5 desktop:flex-col desktop:items-start desktop:gap-2',
          view.wind === null && 'desktop:flex-1 desktop:items-center desktop:[&>div]:flex-col',
        )}
      >
        {groups.map((ids, i) => (
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
  );
}

export function GearPanel({ view }: { view: PlayerView }) {
  const { t } = useTranslation('sky-team');
  return (
    <Panel
      title={t('cockpit.landingGear')}
      badge={
        <MarkerBadge
          icon={<AeroMarkerIcon marker="blue" />}
          label={t('cockpit.blueMarker')}
          bonus={1}
        />
      }
      stackHeaderOnDesktop
    >
      <Slots ids={GEAR_SLOTS} view={view} switches={view.gear} column="switch-right" />
    </Panel>
  );
}

export function FlapsPanel({ view }: { view: PlayerView }) {
  const { t } = useTranslation('sky-team');
  return (
    <Panel
      title={t('cockpit.flaps')}
      badge={
        <MarkerBadge
          icon={<AeroMarkerIcon marker="orange" />}
          label={t('cockpit.orangeMarker')}
          bonus={1}
        />
      }
      stackHeaderOnDesktop
    >
      <Slots ids={FLAPS_SLOTS} view={view} switches={view.flaps} column="switch-left" ordered />
    </Panel>
  );
}

/** The Brakes panel, or the Ice brakes that replace it. */
export function BrakesPanel({ view }: { view: PlayerView }) {
  const { t } = useTranslation('sky-team');
  if (view.scenario.modules.includes('ice-brakes')) return <IceBrakesPanel view={view} />;
  return (
    <Panel
      title={t('cockpit.brakes')}
      badge={<MarkerBadge icon={<BrakeMarkerIcon />} label={t('cockpit.brakeMarker')} bonus={2} />}
      className="justify-between"
    >
      <Slots
        ids={BRAKE_SLOTS}
        view={view}
        switches={BRAKE_SLOTS.map((_, i) => view.brakes > i)}
        ordered
      />
    </Panel>
  );
}

/** Concentration: three spaces that each make a coffee, and the coffee cups in stock. */
export function ConcentrationPanel({ view }: { view: PlayerView }) {
  const { t } = useTranslation('sky-team');
  return (
    <Panel
      title={t('cockpit.concentration')}
      hint={t('cockpit.concentrationHint')}
      className="justify-between"
    >
      <div className="flex items-center justify-between gap-2 max-desktop:flex-col max-desktop:items-start">
        <Slots ids={CONCENTRATION_SLOTS} view={view} className="max-desktop:gap-1.5" />
        <p
          className="flex items-center gap-1"
          aria-label={t('cockpit.coffeeCount', { count: view.coffee })}
        >
          {Array.from({ length: MAX_COFFEE }, (_, i) => (
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
  );
}
