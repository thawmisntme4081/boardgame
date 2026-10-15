import type { ActionCheck } from '../actions';
import type { RoleModule } from './types';

const OK: ActionCheck = { ok: true };

/**
 * As an action, takes an event card from the player discard pile and stores it on the role card
 * (`contingency`), outside the hand and its limit. Playing it removes it from the game (`playEvent.ts`).
 */
export const contingencyPlanner: RoleModule = {
  id: 'contingency-planner',
  storesEvent: true,
  checkAction(state, _seat, action) {
    if (action.type !== 'take-event') return { ok: false, reason: 'wrong-role' };
    if (state.contingency !== null) return { ok: false, reason: 'event-stored' };
    return state.playerDiscard.some((card) => card.kind === 'event' && card.event === action.event)
      ? OK
      : { ok: false, reason: 'no-event' };
  },
  applyAction(state, _seat, action) {
    if (action.type !== 'take-event') return;
    const index = state.playerDiscard.findIndex(
      (card) => card.kind === 'event' && card.event === action.event,
    );
    state.playerDiscard.splice(index, 1);
    state.contingency = action.event;
  },
};
