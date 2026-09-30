import { ICE_OPPOSITE, SLOTS } from '../slots';
import type { RuleModule } from './types';

/** Ice brakes columns (2, 3, 4, 5); the marker must end past the last one. */
export const ICE_BRAKE_COLUMNS = 4;

/**
 * Ice brakes: cover the brakes. Two dice of the column's value, one above and one below the
 * track in the same round, move the marker past it; columns go left to right. The marker
 * must pass the 5 before landing, and the final speed must stay below it.
 */
export const iceBrakes: RuleModule = {
  id: 'ice-brakes',
  checkSlot(ctx, slot) {
    // Only the column right after the marker: not behind it, not skipping ahead.
    return ctx.brakes === SLOTS[slot].index ? null : 'out-of-order';
  },
  place(state, _seat, slot) {
    const opposite = ICE_OPPOSITE[slot];
    if (opposite && state.placed[opposite]) state.brakes++;
    return undefined;
  },
  landing(state) {
    return state.brakes < ICE_BRAKE_COLUMNS ? ['landing-ice-brakes'] : [];
  },
  // Marker left of 2, then past 2, 3, 4 and 5.
  brakeThresholds: [1, 2, 3, 4, 5],
};
