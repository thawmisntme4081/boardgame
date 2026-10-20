import { checkCarry, moveWith } from '../carry';
import { pawnOwner } from '../types';
import type { EventModule } from './types';

/**
 * Airlift: any pawn to any city. Another player's pawn is an offer its owner answers (the core
 * makes it one: see `PawnEventMove`); the pawn's role reacts to arriving (Medic). A player's own
 * pawn that `carries` may take things along (another player's chooses when accepting).
 */
export const airlift: EventModule = {
  id: 'airlift',
  check(state, seat, play) {
    if (play.event !== 'airlift') return { ok: false, reason: 'not-playable' };
    const from = state.pawns[play.pawn];
    if (from === undefined) return { ok: false, reason: 'bad-partner' };
    if (from === play.to) return { ok: false, reason: 'same-city' };
    if (play.carry === undefined) return { ok: true };
    return pawnOwner(play.pawn) === seat
      ? checkCarry(state, play.pawn, play.carry)
      : { ok: false, reason: 'wrong-role' };
  },
  apply(state, _seat, play) {
    if (play.event === 'airlift') moveWith(state, play.pawn, play.to, play.carry);
  },
};
