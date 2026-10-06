// Which cockpit panels show, in which order below desktop, and where they sit on desktop.
import type { PlayerView, Seat } from '@sky/rules';
import type { CSSProperties } from 'react';

export type Section =
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

/** Whether the scenario has this panel: module panels only show with their module. */
function isSectionShown(section: Section, view: PlayerView): boolean {
  const modules = view.scenario.modules;
  switch (section) {
    case 'wind':
      return view.wind !== null;
    case 'kerosene':
      return modules.includes('kerosene') || modules.includes('kerosene-leak');
    case 'intern':
      return modules.includes('intern');
    case 'alarms':
      return view.alarms !== null;
    default:
      return true;
  }
}

/** The panels in play, in this seat's order. */
export const shownSections = (view: PlayerView): Section[] =>
  sectionOrder(view.seat, view.scenario.modules.includes('ice-brakes')).filter((section) =>
    isSectionShown(section, view),
  );

/** Module panels with a full-height desktop column of their own (they widen the page). */
const MODULE_COLUMNS = ['kerosene', 'intern'] as const satisfies readonly Section[];

/** How many module columns the desktop cockpit has (the game container widens for each). */
export const moduleColumnCount = (view: PlayerView): number =>
  MODULE_COLUMNS.filter((section) => isSectionShown(section, view)).length;

/** Desktop column widths: the outer side columns, a module column, the narrow Radio column. */
const SIDE_COL = '13%';
const MODULE_COL = '7rem';
const RADIO_COL = '5.5rem';
const FLEX_COL = 'minmax(0, 1fr)';

/**
 * The desktop grid, built from the panels in play. Landing gear left and Flaps right share
 * the top row, so they always have the same height. Axis & Engines spans the top two rows,
 * with Wind above Radio beside it (Radio alone, both rows, when there is no Wind). Brakes and
 * Concentration split the centre below. Kerosene and Intern each get a full-height column
 * left of Flaps. Alarms take a row of their own under the centre.
 */
export function desktopGrid(shown: readonly Section[]): CSSProperties {
  const has = (s: Section) => shown.includes(s);
  const mods = MODULE_COLUMNS.filter(has);
  const row = (...cells: string[]) => `'${cells.join(' ')}'`;
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
  // The centre is four columns. With Wind they are equal. Without, Radio is a narrow column
  // (its spaces stacked): 1fr · R · 1fr · R, Axis & Engines spanning the first three and
  // Radio the last, so Brakes and Concentration (1fr + R each) match and fill the width.
  const centre = has('wind')
    ? ['repeat(4, minmax(0, 1fr))']
    : [FLEX_COL, RADIO_COL, FLEX_COL, RADIO_COL];
  const columns = [SIDE_COL, ...centre, ...mods.map(() => MODULE_COL), SIDE_COL];
  return {
    '--cockpit-areas': rows.join(' '),
    '--cockpit-columns': columns.join(' '),
  } as CSSProperties;
}

/** Below desktop every panel takes the full width, so the per-seat order reads top to bottom. */
export const SPAN = 'max-desktop:col-span-2';
/** Below desktop, Radio and Concentration share a row instead of each taking the full width. */
export const HALF: Partial<Record<Section, string>> = {
  radio: 'max-desktop:col-span-1',
  concentration: 'max-desktop:col-span-1',
};

/** Desktop: each panel in its named grid area (see `desktopGrid`). */
export const AREA: Record<Section, string> = {
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
