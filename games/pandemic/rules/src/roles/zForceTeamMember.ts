import { movePawn, type ActionCheck } from '../actions';
import type { CityId } from '../cities';
import type { RoleModule } from './types';

/** The two cities the Z-Force Team Member moves to as an action (Montreal, where it starts, and Essen). */
export const ZFORCE_CITIES: readonly CityId[] = ['montreal', 'essen'];

const OK: ActionCheck = { ok: true };

/**
 * The Z-Force Team Member (a Gen Con 2016 promo): starts in Montreal; as an action, moves to
 * Montreal or Essen from anywhere with no card (`montreal-essen`, its own pawn only); other
 * players in its city may give up to 2 of the cards of its cures (`cureHelp`, see `cure.ts`).
 */
export const zForceTeamMember: RoleModule = {
  id: 'z-force-team-member',
  startCity: 'montreal',
  cureHelp: 2,
  checkAction(state, seat, action) {
    if (action.type !== 'montreal-essen' || !ZFORCE_CITIES.includes(action.to)) {
      return { ok: false, reason: 'wrong-role' };
    }
    return state.pawns[seat] === action.to ? { ok: false, reason: 'same-city' } : OK;
  },
  applyAction(state, seat, action) {
    if (action.type === 'montreal-essen') movePawn(state, seat, action.to);
  },
};
