// Panels for the Flight Log modules; the rules live in @sky/shared.
import { KEROSENE_START, windSpeed, type PlayerView, type SlotId } from '@sky/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DieFace } from '@/svgs/DieFace';
import { WindRing } from '@/svgs/WindRing';
import { Panel } from './Panel';
import { Slot } from './Slot';

/**
 * The kerosene track. When fuel burns, the bar slides down and a red "−N" floats up and fades
 * (keyed per drop, so each burn replays it).
 */
function KeroseneGauge({ kerosene }: { kerosene: number }) {
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
        aria-label="Kerosene"
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
        {kerosene} / {KEROSENE_START} left{kerosene === 0 && ': empty'}
      </p>
    </div>
  );
}

function KerosenePanel({ view, leak }: { view: PlayerView; leak: boolean }) {
  return (
    <Panel
      title={leak ? 'Kerosene leak' : 'Kerosene'}
      hint={
        leak ? 'Each round: engine difference + 1' : 'Either player · burns its value; none: −6'
      }
    >
      <div className="flex items-center gap-3">
        {!leak && <Slot slot="kerosene" view={view} />}
        <KeroseneGauge kerosene={view.kerosene ?? 0} />
      </div>
    </Panel>
  );
}

function WindPanel({ view }: { view: PlayerView }) {
  const speed = windSpeed(view.wind);
  return (
    <Panel title="Wind" hint="The axis turns the ring each round">
      <div className="flex items-center gap-3">
        <WindRing wind={view.wind ?? 0} />
        <p className="text-sm">
          <span className="block text-2xl font-bold tabular-nums">
            {speed > 0 ? `+${speed}` : speed}
          </span>
          added to the engines
        </p>
      </div>
    </Panel>
  );
}

/**
 * Between two intern tokens: the pilot takes from the left (blue, pointing right) and the
 * co-pilot from the right (orange, pointing left), as on the Intern board.
 */
function InternArrows() {
  return (
    <li aria-hidden="true" className="flex w-2 flex-col items-center justify-center">
      <ChevronRight strokeWidth={3} className="-my-0.5 size-3 shrink-0 text-pilot" />
      <ChevronLeft strokeWidth={3} className="-my-0.5 size-3 shrink-0 text-copilot" />
    </li>
  );
}

function InternPanel({ view }: { view: PlayerView }) {
  const tokens = view.intern ?? [];
  return (
    <Panel title="Intern" hint="Die ≠ next token · the token goes on any of your spaces">
      <div className="flex flex-wrap items-center gap-1">
        <Slot slot="internPilot" view={view} />
        <ol
          className="flex flex-1 items-center justify-center gap-0.5"
          aria-label={
            tokens.length > 0 ? `Intern tokens left: ${tokens.join(', ')}` : 'Intern fully trained'
          }
        >
          {tokens.map((value, i) => (
            <Fragment key={value}>
              {i > 0 && <InternArrows />}
              <li className={cn(i > 0 && i < tokens.length - 1 && 'opacity-70')}>
                <DieFace value={value} seat="pilot" kind="intern" className="size-[1.8rem]" />
              </li>
            </Fragment>
          ))}
          {tokens.length === 0 && <li className="text-xs text-muted-foreground">Trained!</li>}
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
  const cell = (node: ReactNode, key: string) => (
    <div key={key} className="flex justify-center">
      {node}
    </div>
  );
  return (
    <Panel title="Ice brakes" hint="Pairs: pilot above, either below" className="justify-between">
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
                aria-label={`Ice brake ${i + 2}: ${view.brakes > i ? 'deployed' : 'not deployed'}`}
                className={cn(
                  'h-2 w-10 rounded-full',
                  view.brakes > i ? 'bg-light-on' : 'bg-muted-foreground/25',
                )}
              />,
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

/** Kerosene, Wind and Intern panels for the scenario's modules, below the control panel. */
export function ModulePanels({ view }: { view: PlayerView }) {
  const modules = view.scenario.modules;
  const panels: ReactNode[] = [];
  if (modules.includes('kerosene') || modules.includes('kerosene-leak')) {
    panels.push(
      <KerosenePanel key="kerosene" view={view} leak={modules.includes('kerosene-leak')} />,
    );
  }
  if (modules.includes('wind')) panels.push(<WindPanel key="wind" view={view} />);
  if (modules.includes('intern')) panels.push(<InternPanel key="intern" view={view} />);
  if (panels.length === 0) return null;
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 desktop:grid-cols-3 @xl:grid-cols-2">{panels}</div>
  );
}
