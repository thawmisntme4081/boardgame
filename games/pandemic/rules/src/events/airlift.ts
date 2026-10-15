import { movePawn } from '../actions';
import type { EventModule } from './types';

/**
 * Airlift: any pawn to any city. Another player's pawn is an offer its owner answers (the core
 * makes it one: see `PawnEventMove`); the pawn's role reacts to arriving (Medic).
 */
export const airlift: EventModule = {
  id: 'airlift',
  check(state, _seat, play) {
    if (play.event !== 'airlift') return { ok: false, reason: 'not-playable' };
    const from = state.pawns[play.pawn];
    if (from === undefined) return { ok: false, reason: 'bad-partner' };
    return from === play.to ? { ok: false, reason: 'same-city' } : { ok: true };
  },
  apply(state, _seat, play) {
    if (play.event === 'airlift') movePawn(state, play.pawn, play.to);
  },
};
