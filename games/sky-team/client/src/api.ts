// What the Sky Team screens ask the server for, as moves through the platform. Components call
// these; only the server changes the game.
import {
  SLOTS,
  type AbilityAction,
  type AbilityId,
  type GameSetup,
  type Seat,
  type SlotId,
} from '@sky/rules';
import { platform } from './platform';
import { useSkyTeam } from './store';

export const ready = () => platform().send({ type: 'ready' });

/** Before round 1: pick your Special Ability card (`null` takes it back). */
export const pickAbility = (ability: AbilityId | null) =>
  platform().send({ type: 'pick-ability', ability });

/** Before round 1: the creator takes a seat (the partner gets the other). */
export const chooseSeat = (seat: Seat) => platform().chooseSeat(seat);

/** Before round 1: confirm roles and abilities; round 1 starts once both have. */
export const confirmSetup = () => platform().send({ type: 'confirm' });

/**
 * Places the selected die, with its draft coffee, on `slot`. An Intern space takes two
 * taps: the first picks it, the second says where its token goes.
 */
export async function placeSelected(slot: SlotId): Promise<boolean> {
  const { selectedDieId, coffeeDelta, internSlot, setInternSlot } = useSkyTeam.getState();
  if (!selectedDieId) return false;
  if (!internSlot && SLOTS[slot].group === 'intern') {
    setInternSlot(slot);
    return true;
  }
  const intent = internSlot
    ? { dieId: selectedDieId, slot: internSlot, coffeeDelta, tokenSlot: slot }
    : { dieId: selectedDieId, slot, coffeeDelta };
  return platform().send({ type: 'place', ...intent });
}

/** Adaptation, Anticipation or Working Together, on one of your dice. */
export const playAbility = (action: AbilityAction) =>
  platform().send({ type: 'ability', ...action });

/** Working Together: take back your offer before your partner answers. */
export const cancelSwap = () => platform().send({ type: 'cancel-swap' });

export const spendReroll = () => platform().send({ type: 'spend-reroll' });

export const reroll = (dieIds: string[]) => platform().send({ type: 'reroll', dieIds });

/** A new game in the same room: the same scenario, or the one in `setup`. */
export const rematch = (setup: GameSetup = {}) => platform().rematch(setup);

/** Gives up the seat for good and goes back to the game's page. */
export const leaveGame = () => platform().leave();
