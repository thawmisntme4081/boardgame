// What to point at on the board when a player looks at the final position of a lost game
// ("View board"): the dice and the places that caused the end. Display only.
import {
  AXIS_LIMIT,
  MANDATORY_SLOTS,
  SLOT_IDS,
  SLOTS,
  slotActive,
  type EndReason,
  type PlayerView,
  type SlotGroup,
  type SlotId,
} from '@sky/rules';

export interface EndHighlight {
  /** Spaces whose dice (or emptiness) explain the end. */
  slots: SlotId[];
  /** The axis zone the needle is in, -3..3: marked on the dial. */
  axisZone?: number;
  /** The speed on the dial. */
  speed?: boolean;
  /** Approach-track spaces (by index). */
  approach?: number[];
  /** A gauge: the kerosene. */
  gauge?: 'kerosene';
}

const ENGINES: readonly SlotId[] = ['enginePilot', 'engineCopilot'];
const AXIS: readonly SlotId[] = ['axisPilot', 'axisCopilot'];

/** The spaces of a group that the scenario plays. */
const inGroup = (view: PlayerView, group: SlotGroup): SlotId[] =>
  SLOT_IDS.filter((slot) => SLOTS[slot].group === group && slotActive(view.scenario.modules, slot));
/** Of those spaces, the ones left without a die. */
const empty = (view: PlayerView, slots: readonly SlotId[]): SlotId[] =>
  slots.filter((slot) => slotActive(view.scenario.modules, slot) && !view.placed[slot]);
/** Of those spaces, the ones the scenario plays (a covered space has no die to point at). */
const played = (view: PlayerView, slots: readonly SlotId[]): SlotId[] =>
  slots.filter((slot) => slotActive(view.scenario.modules, slot));

/** What one end reason points at. */
function markFor(reason: EndReason, view: PlayerView): EndHighlight | null {
  const here = view.approachIndex;
  switch (reason) {
    case 'spin':
      // The two Axis dice tipped the plane into the red zone the needle points to.
      return { slots: [...AXIS], axisZone: view.axis <= -AXIS_LIMIT ? -3 : 3 };
    case 'collision':
    case 'overshoot':
      // The Engine dice set the speed that flew into planes, or past the airport.
      return { slots: played(view, ENGINES), speed: true, approach: [here] };
    case 'turn':
      return {
        slots: played(view, ENGINES),
        speed: true,
        approach: [here],
        axisZone: Math.max(-3, Math.min(3, view.axis)),
      };
    case 'missed-airport':
      return { slots: [], approach: [here, view.approachPlanes.length - 1] };
    case 'mandatory-missing':
      return { slots: empty(view, MANDATORY_SLOTS) };
    case 'landing-traffic':
      return {
        slots: [],
        approach: view.approachPlanes.flatMap((planes, i) => (planes > 0 ? [i] : [])),
      };
    case 'landing-gear':
      return { slots: empty(view, inGroup(view, 'gear')) };
    case 'landing-flaps':
      return { slots: empty(view, inGroup(view, 'flaps')) };
    case 'landing-axis':
      return { slots: [...AXIS], axisZone: Math.max(-3, Math.min(3, view.axis)) };
    case 'landing-brakes':
      return {
        slots: [...played(view, ENGINES), ...empty(view, inGroup(view, 'brakes'))],
        speed: true,
      };
    case 'landing-ice-brakes':
      return { slots: empty(view, inGroup(view, 'iceBrakes')) };
    case 'landing-intern':
      return { slots: inGroup(view, 'intern') };
    case 'kerosene':
      return { slots: view.placed.kerosene ? ['kerosene'] : [], gauge: 'kerosene' };
    default:
      // time-up: nothing on the board explains it.
      return null;
  }
}

/**
 * The highlight for how the game ended (every failed landing condition when there are
 * several), or `null` when there is nothing to point at.
 */
export function endHighlight(view: PlayerView): EndHighlight | null {
  const reasons = view.landingFailures ?? (view.endReason ? [view.endReason] : []);
  const marks = reasons.flatMap((reason) => markFor(reason, view) ?? []);
  if (marks.length === 0) return null;
  const merged: EndHighlight = { slots: [...new Set(marks.flatMap((m) => m.slots))] };
  for (const mark of marks) {
    if (mark.axisZone !== undefined) merged.axisZone = mark.axisZone;
    if (mark.speed) merged.speed = true;
    if (mark.gauge) merged.gauge = mark.gauge;
    if (mark.approach)
      merged.approach = [...new Set([...(merged.approach ?? []), ...mark.approach])];
  }
  return merged;
}
