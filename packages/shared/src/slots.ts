import type { DieValue, Seat, SlotId } from './types';

export type SlotGroup =
  'axis' | 'engines' | 'radio' | 'gear' | 'flaps' | 'brakes' | 'concentration';

export interface SlotDef {
  group: SlotGroup;
  /** Position within the group (switch number for gear, flaps and brakes). */
  index: number;
  seats: readonly Seat[];
  /** Allowed die values; any value when absent. */
  values?: readonly DieValue[];
}

const PILOT = ['pilot'] as const;
const COPILOT = ['copilot'] as const;
const BOTH = ['pilot', 'copilot'] as const;

export const SLOTS: Record<SlotId, SlotDef> = {
  axisPilot: { group: 'axis', index: 0, seats: PILOT },
  axisCopilot: { group: 'axis', index: 1, seats: COPILOT },
  enginePilot: { group: 'engines', index: 0, seats: PILOT },
  engineCopilot: { group: 'engines', index: 1, seats: COPILOT },
  radioPilot: { group: 'radio', index: 0, seats: PILOT },
  radioCopilot1: { group: 'radio', index: 1, seats: COPILOT },
  radioCopilot2: { group: 'radio', index: 2, seats: COPILOT },
  gear1: { group: 'gear', index: 0, seats: PILOT, values: [1, 2] },
  gear2: { group: 'gear', index: 1, seats: PILOT, values: [3, 4] },
  gear3: { group: 'gear', index: 2, seats: PILOT, values: [5, 6] },
  brakes1: { group: 'brakes', index: 0, seats: PILOT, values: [2] },
  brakes2: { group: 'brakes', index: 1, seats: PILOT, values: [4] },
  brakes3: { group: 'brakes', index: 2, seats: PILOT, values: [6] },
  flaps1: { group: 'flaps', index: 0, seats: COPILOT, values: [1, 2] },
  flaps2: { group: 'flaps', index: 1, seats: COPILOT, values: [2, 3] },
  flaps3: { group: 'flaps', index: 2, seats: COPILOT, values: [4, 5] },
  flaps4: { group: 'flaps', index: 3, seats: COPILOT, values: [5, 6] },
  concentration1: { group: 'concentration', index: 0, seats: BOTH },
  concentration2: { group: 'concentration', index: 1, seats: BOTH },
  concentration3: { group: 'concentration', index: 2, seats: BOTH },
};

export const SLOT_IDS = Object.keys(SLOTS) as SlotId[];

/** Each player must have a die here at the end of every round. */
export const MANDATORY_SLOTS: readonly SlotId[] = [
  'axisPilot',
  'axisCopilot',
  'enginePilot',
  'engineCopilot',
];
