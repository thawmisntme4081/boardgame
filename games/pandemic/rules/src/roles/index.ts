// The seven role cards of the base game, the fan-made ones and the Gen Con 2016 promo, by id.
// Each role's powers are hooks (`RoleModule`); a role without powers yet is only its id.
import type { ActionState, RoleId, SeatId } from '../types';
import { contingencyPlanner } from './contingencyPlanner';
import { crisisMitigator } from './crisisMitigator';
import { medic } from './medic';
import { operationsExpert } from './operationsExpert';
import { quarantineSpecialist } from './quarantineSpecialist';
import { teacher } from './teacher';
import { zForceTeamMember } from './zForceTeamMember';
import type { RoleModule } from './types';

export * from './types';
export { MAX_STUDENTS } from './teacher';
export { ZFORCE_CITIES } from './zForceTeamMember';

export const ROLES: Readonly<Record<RoleId, RoleModule>> = {
  'contingency-planner': contingencyPlanner,
  // Moves other pawns (their owner agrees: a move offer) and any pawn to a city with another.
  dispatcher: { id: 'dispatcher', movesPawns: true },
  medic,
  'operations-expert': operationsExpert,
  'quarantine-specialist': quarantineSpecialist,
  // Gives any city card on their own turn (taking from them still needs the shared city).
  researcher: { id: 'researcher', canGive: () => true },
  // Discovers a cure with 4 cards of a color.
  scientist: { id: 'scientist', cardsToCure: 4 },
  teacher,
  // Takes up to 3 cubes and/or 1 other pawn along whenever its pawn leaves a city.
  'relocation-specialist': { id: 'relocation-specialist', carries: true },
  'crisis-mitigator': crisisMitigator,
  // 5 actions a turn.
  generalist: { id: 'generalist', actionsPerTurn: () => 5 },
  'z-force-team-member': zForceTeamMember,
};

/** The role a seat holds (`undefined` for a seat not in the game). */
export function roleOf(state: Pick<ActionState, 'roles'>, seat: SeatId): RoleModule | undefined {
  const id = state.roles[seat];
  return id === undefined ? undefined : ROLES[id];
}

/** Every role in play with the seat that holds it, in turn order. */
export function rolesInPlay(
  state: Pick<ActionState, 'seats' | 'roles'>,
): { seat: SeatId; role: RoleModule }[] {
  return state.seats.flatMap((seat) => {
    const role = roleOf(state, seat);
    return role ? [{ seat, role }] : [];
  });
}
