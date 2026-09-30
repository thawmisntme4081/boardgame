// What tapping a space would do with the current selection. The shared rules decide.
import {
  canPlaceInView,
  nextInternToken,
  SLOT_IDS,
  SLOTS,
  type DieValue,
  type PlaceIntent,
  type PlayerView,
  type SlotId,
} from '@sky/shared';

export interface Selection {
  selectedDieId: string | null;
  coffeeDelta: number;
  /** Intern: the Intern space already chosen for the die, waiting for the token's space. */
  internSlot: SlotId | null;
}

/** The move tapping `slot` sends (for an Intern space, before the token has a space: none). */
export function intentFor(sel: Selection, slot: SlotId): PlaceIntent | null {
  if (!sel.selectedDieId) return null;
  const base = { dieId: sel.selectedDieId, coffeeDelta: sel.coffeeDelta };
  if (sel.internSlot) return { ...base, slot: sel.internSlot, tokenSlot: slot };
  return SLOTS[slot].group === 'intern' ? null : { ...base, slot };
}

/** Whether tapping `slot` does something: place the die, choose an Intern space, or place the token. */
export function slotValid(view: PlayerView, sel: Selection, slot: SlotId): boolean {
  if (!sel.selectedDieId) return false;
  if (!sel.internSlot && SLOTS[slot].group === 'intern') {
    const base = { dieId: sel.selectedDieId, coffeeDelta: sel.coffeeDelta, slot };
    return SLOT_IDS.some((tokenSlot) => canPlaceInView(view, { ...base, tokenSlot }).ok);
  }
  const intent = intentFor(sel, slot);
  return intent !== null && canPlaceInView(view, intent).ok;
}

/** The number about to go on a space: the Intern token, the traffic die, or the die with coffee. */
export function placingValue(view: PlayerView, sel: Selection): DieValue | undefined {
  if (sel.internSlot) return nextInternToken(view.intern, view.seat);
  if (view.bonus?.die.id === sel.selectedDieId) return view.bonus.die.value;
  const die = view.myDice.find((d) => d.id === sel.selectedDieId);
  return die && ((die.value + sel.coffeeDelta) as DieValue);
}
