// A role's own actions: the turn checks every action shares, then the role's hooks. Only the
// seat holding the role can take them.
import { checkTurnAction, spendAction, type ActionCheck } from './actions';
import { ROLE_ACTION_TYPES, roleOf, type RoleAction } from './roles';
import type { ActionState, GameState, SeatId } from './types';

export const isRoleAction = (move: { type: string }): move is RoleAction =>
  ROLE_ACTION_TYPES.includes(move.type);

export function checkRoleAction(state: ActionState, seat: SeatId, action: RoleAction): ActionCheck {
  const turn = checkTurnAction(state, seat);
  if (!turn.ok) return turn;
  const check = roleOf(state, seat)?.checkAction;
  return check ? check(state, seat, action) : { ok: false, reason: 'wrong-role' };
}

/** Does the role action (it must be legal: see `checkRoleAction`) and returns the new state. */
export function applyRoleAction(state: GameState, seat: SeatId, action: RoleAction): GameState {
  const check = checkRoleAction(state, seat, action);
  if (!check.ok) throw new Error(`Illegal role action: ${check.reason}`);
  const s = structuredClone(state);
  roleOf(s, seat)?.applyAction?.(s, seat, action);
  spendAction(s.turn);
  return s;
}
