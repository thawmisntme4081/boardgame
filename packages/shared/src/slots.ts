import type { DieValue, ModuleId, Seat, SlotId } from './types';

export type SlotGroup =
  | 'axis'
  | 'engines'
  | 'radio'
  | 'gear'
  | 'flaps'
  | 'brakes'
  | 'concentration'
  | 'kerosene'
  | 'intern'
  | 'iceBrakes';

export interface SlotDef {
  group: SlotGroup;
  /** Position within the group (switch number for gear, flaps and brakes; column for ice brakes). */
  index: number;
  seats: readonly Seat[];
  /** Allowed die values; any value when absent. */
  values?: readonly DieValue[];
  /** The slot exists only in scenarios with this module. */
  module?: ModuleId;
  /** The slot is covered (unplayable) in scenarios with this module. */
  coveredBy?: ModuleId;
}

const PILOT = ['pilot'] as const;
const COPILOT = ['copilot'] as const;
const BOTH = ['pilot', 'copilot'] as const;

/** Ice brakes: the space above the track is blue, the one below is blue and orange. */
const ice = (index: number, value: DieValue, row: 'top' | 'bottom'): SlotDef => ({
  group: 'iceBrakes',
  index,
  seats: row === 'top' ? PILOT : BOTH,
  values: [value],
  module: 'ice-brakes',
});

export const SLOTS: Record<SlotId, SlotDef> = {
  axisPilot: { group: 'axis', index: 0, seats: PILOT },
  axisCopilot: { group: 'axis', index: 1, seats: COPILOT },
  enginePilot: { group: 'engines', index: 0, seats: PILOT, coveredBy: 'engines-out' },
  engineCopilot: { group: 'engines', index: 1, seats: COPILOT, coveredBy: 'engines-out' },
  radioPilot: { group: 'radio', index: 0, seats: PILOT },
  radioCopilot1: { group: 'radio', index: 1, seats: COPILOT },
  radioCopilot2: { group: 'radio', index: 2, seats: COPILOT },
  gear1: { group: 'gear', index: 0, seats: PILOT, values: [1, 2] },
  gear2: { group: 'gear', index: 1, seats: PILOT, values: [3, 4] },
  gear3: { group: 'gear', index: 2, seats: PILOT, values: [5, 6] },
  brakes1: { group: 'brakes', index: 0, seats: PILOT, values: [2], coveredBy: 'ice-brakes' },
  brakes2: { group: 'brakes', index: 1, seats: PILOT, values: [4], coveredBy: 'ice-brakes' },
  brakes3: { group: 'brakes', index: 2, seats: PILOT, values: [6], coveredBy: 'ice-brakes' },
  flaps1: { group: 'flaps', index: 0, seats: COPILOT, values: [1, 2] },
  flaps2: { group: 'flaps', index: 1, seats: COPILOT, values: [2, 3] },
  flaps3: { group: 'flaps', index: 2, seats: COPILOT, values: [4, 5] },
  flaps4: { group: 'flaps', index: 3, seats: COPILOT, values: [5, 6] },
  concentration1: { group: 'concentration', index: 0, seats: BOTH },
  concentration2: { group: 'concentration', index: 1, seats: BOTH },
  concentration3: { group: 'concentration', index: 2, seats: BOTH },
  kerosene: { group: 'kerosene', index: 0, seats: BOTH, module: 'kerosene' },
  internPilot: { group: 'intern', index: 0, seats: PILOT, module: 'intern' },
  internCopilot: { group: 'intern', index: 1, seats: COPILOT, module: 'intern' },
  ice2Top: ice(0, 2, 'top'),
  ice2Bottom: ice(0, 2, 'bottom'),
  ice3Top: ice(1, 3, 'top'),
  ice3Bottom: ice(1, 3, 'bottom'),
  ice4Top: ice(2, 4, 'top'),
  ice4Bottom: ice(2, 4, 'bottom'),
  ice5Top: ice(3, 5, 'top'),
  ice5Bottom: ice(3, 5, 'bottom'),
};

export const SLOT_IDS = Object.keys(SLOTS) as SlotId[];

/** Whether `slot` is on the board with these modules. */
export function slotActive(modules: readonly ModuleId[], slot: SlotId): boolean {
  const def = SLOTS[slot];
  if (!def) return false;
  if (def.module && !modules.includes(def.module)) return false;
  return !(def.coveredBy && modules.includes(def.coveredBy));
}

/** The slots a scenario with these modules plays with. */
export const activeSlots = (modules: readonly ModuleId[]): SlotId[] =>
  SLOT_IDS.filter((slot) => slotActive(modules, slot));

/** Ice brakes: the space on the other side of the track, in the same column. */
export const ICE_OPPOSITE: Partial<Record<SlotId, SlotId>> = {
  ice2Top: 'ice2Bottom',
  ice2Bottom: 'ice2Top',
  ice3Top: 'ice3Bottom',
  ice3Bottom: 'ice3Top',
  ice4Top: 'ice4Bottom',
  ice4Bottom: 'ice4Top',
  ice5Top: 'ice5Bottom',
  ice5Bottom: 'ice5Top',
};

/** Each player must have a die here at the end of every round (when the slot is in play). */
export const MANDATORY_SLOTS: readonly SlotId[] = [
  'axisPilot',
  'axisCopilot',
  'enginePilot',
  'engineCopilot',
];
