import type { ActionCheck } from '../actions';
import { actingPawn, pawnsOf } from '../pawns';
import type { PawnId } from '../types';
import type { RoleModule } from './types';

/** Students a Teacher may create in a game (nothing removes one). */
export const MAX_STUDENTS = 2;

const OK: ActionCheck = { ok: true };

/**
 * The Teacher (a fan-made role): as an action of the teacher pawn, creates a student pawn in its
 * city, at most two a game. A student does the basic actions with the Teacher's hand when it is
 * the pawn chosen for the turn (`pawns.ts`); it has no power of its own.
 */
export const teacher: RoleModule = {
  id: 'teacher',
  checkAction(state, seat, action) {
    if (action.type !== 'create-student') return { ok: false, reason: 'wrong-role' };
    if (actingPawn(state, seat) !== seat) return { ok: false, reason: 'teacher-pawn-only' };
    return pawnsOf(state, seat).length <= MAX_STUDENTS
      ? OK
      : { ok: false, reason: 'no-students-left' };
  },
  applyAction(state, seat, action) {
    if (action.type !== 'create-student') return;
    // The first student is `p1-s1`, the second `p1-s2`.
    const student = `${seat}-s${pawnsOf(state, seat).length}` as PawnId;
    state.pawns[student] = state.pawns[seat];
  },
};
