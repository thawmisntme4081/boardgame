import { discardCity, hasCityCard, movePawn, type ActionCheck } from '../actions';
import type { RoleModule } from './types';

const OK: ActionCheck = { ok: true };

/**
 * Builds a research station without a card; once a turn, from a station, discards any city card
 * to fly to any city (`ops-flight`, one action).
 */
export const operationsExpert: RoleModule = {
  id: 'operations-expert',
  buildsWithoutCard: true,
  checkAction(state, seat, action) {
    if (action.type !== 'ops-flight') return { ok: false, reason: 'wrong-role' };
    const here = state.pawns[seat];
    if (here === undefined || !state.stations.includes(here))
      return { ok: false, reason: 'no-station' };
    if (state.turn.flightUsed) return { ok: false, reason: 'power-used' };
    if (action.to === here) return { ok: false, reason: 'same-city' };
    return hasCityCard(state.hands[seat], action.card) ? OK : { ok: false, reason: 'card-missing' };
  },
  applyAction(state, seat, action) {
    if (action.type !== 'ops-flight') return;
    discardCity(state, seat, action.card);
    movePawn(state, seat, action.to);
    state.turn.flightUsed = true;
  },
};
