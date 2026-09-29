import type { PlayerView, SlotId } from '@sky/shared';
import { ChevronDown, ChevronRight, Coffee } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AxisDial } from '@/svgs/AxisDial';
import { SpeedGauge } from '@/svgs/SpeedGauge';
import { Switch } from '@/svgs/Switch';
import { Slot } from './Slot';

type Section = 'axis' | 'engines' | 'gear' | 'flaps' | 'radio' | 'brakes' | 'concentration';

/** Top to bottom below desktop; radio and brakes share a row when there is room. */
const ORDER: Section[] = ['axis', 'engines', 'gear', 'flaps', 'radio', 'brakes', 'concentration'];

/**
 * Below desktop only (`max-desktop:`, so the desktop grid areas are untouched): two
 * columns, panels full width on phones and two per row once the cockpit is wide. Radio and
 * brakes share a row from 28rem, where three slots and two arrows fit without wrapping.
 */
const SPAN: Record<Section, string> = {
  axis: 'max-desktop:col-span-2 @xl:max-desktop:col-span-1',
  engines: 'max-desktop:col-span-2 @xl:max-desktop:col-span-1',
  gear: 'max-desktop:col-span-2 @xl:max-desktop:col-span-1',
  flaps: 'max-desktop:col-span-2 @xl:max-desktop:col-span-1',
  radio: 'max-desktop:col-span-2 @md:max-desktop:col-span-1',
  brakes: 'max-desktop:col-span-2 @md:max-desktop:col-span-1',
  concentration: 'max-desktop:col-span-2',
};

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
};

const PANEL = 'flex h-full flex-col gap-2 rounded-2xl border bg-card p-3';
/** The same panel look, applied only on desktop (the two radio halves). */
const DESKTOP_PANEL =
  'desktop:flex desktop:h-full desktop:flex-col desktop:gap-2 desktop:rounded-2xl desktop:border desktop:bg-card desktop:p-3';

function PanelHeader({
  title,
  hint,
  side,
  className,
}: {
  title: string;
  hint?: string;
  side?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex items-baseline justify-between gap-2',
        side && 'desktop:flex-col desktop:items-start desktop:gap-0',
        className,
      )}
    >
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && (
        <p className={cn('text-right text-xs text-muted-foreground', side && 'desktop:text-left')}>
          {hint}
        </p>
      )}
    </header>
  );
}

function Panel({
  title,
  hint,
  side,
  className,
  children,
}: {
  title: string;
  hint?: string;
  side?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(PANEL, className)} aria-label={title}>
      <PanelHeader title={title} hint={hint} side={side} />
      {children}
    </section>
  );
}

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
            {switches && <Switch on={switches[i]!} label={`Switch ${i + 1}`} />}
            <Slot slot={id} view={view} />
          </div>
        </Fragment>
      ))}
    </div>
  );
}

export function Cockpit({ view }: { view: PlayerView }) {
  const sections: Record<Section, ReactNode> = {
    axis: (
      <Panel title="Axis" hint="Must be level to land">
        <div className="flex items-center justify-between gap-2">
          <Slot slot="axisPilot" view={view} />
          <AxisDial axis={view.axis} />
          <Slot slot="axisCopilot" view={view} />
        </div>
      </Panel>
    ),
    engines: (
      <Panel
        title="Engines"
        hint={
          view.finalRound
            ? 'Final round: speed must be below the brakes'
            : 'Sum sets how far you fly'
        }
      >
        <div className="flex items-center justify-between gap-2">
          <Slot slot="enginePilot" view={view} />
          <SpeedGauge view={view} />
          <Slot slot="engineCopilot" view={view} />
        </div>
      </Panel>
    ),
    radio: (
      <section aria-label="Radio" className={cn(PANEL, 'desktop:contents')}>
        <PanelHeader title="Radio" hint="N clears a plane N−1 ahead" className="desktop:hidden" />
        <div className="flex flex-wrap items-end gap-2 desktop:contents">
          <div className={cn('desktop:[grid-area:radioPilot]', DESKTOP_PANEL)}>
            <PanelHeader
              title="Radio"
              hint="Pilot · N clears a plane N−1 ahead"
              side
              className="hidden desktop:flex"
            />
            <Slots ids={['radioPilot']} view={view} />
          </div>
          <div className={cn('desktop:[grid-area:radioCopilot]', DESKTOP_PANEL)}>
            <PanelHeader
              title="Radio"
              hint="Co-pilot · N clears a plane N−1 ahead"
              side
              className="hidden desktop:flex"
            />
            <Slots ids={['radioCopilot1', 'radioCopilot2']} view={view} />
          </div>
        </div>
      </section>
    ),
    gear: (
      <Panel title="Landing gear" hint="Pilot · any order" side>
        <Slots
          ids={['gear1', 'gear2', 'gear3']}
          view={view}
          switches={view.gear}
          column="switch-right"
        />
      </Panel>
    ),
    flaps: (
      <Panel title="Flaps" hint="Co-pilot · top to bottom" side>
        <Slots
          ids={['flaps1', 'flaps2', 'flaps3', 'flaps4']}
          view={view}
          switches={view.flaps}
          column="switch-left"
          ordered
        />
      </Panel>
    ),
    brakes: (
      <Panel title="Brakes" hint="Pilot · 2, then 4, then 6" className="justify-between">
        <Slots
          ids={['brakes1', 'brakes2', 'brakes3']}
          view={view}
          switches={[0, 1, 2].map((i) => view.brakes > i)}
          ordered
        />
      </Panel>
    ),
    concentration: (
      <Panel title="Concentration" hint="Any die: +1 coffee (max 3)" className="justify-between">
        <div className="flex items-center justify-between gap-2">
          <Slots ids={['concentration1', 'concentration2', 'concentration3']} view={view} />
          <p className="flex items-center gap-1" aria-label={`${view.coffee} coffee`}>
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
      <div className="cockpit-grid grid grid-cols-2 gap-3">
        {ORDER.map((id) => (
          // Grid items stretch by default, and Panel is h-full, so every panel fills its row.
          <div key={id} className={cn(SPAN[id], AREA[id])}>
            {sections[id]}
          </div>
        ))}
      </div>
    </div>
  );
}
