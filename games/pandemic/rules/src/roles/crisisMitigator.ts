import { COLORS, type CityId } from '../cities';
import { ACTIONS_PER_TURN } from '../types';
import type { RoleModule } from './types';

/** The most actions a Crisis Mitigator's turn can have (4 cubes or more). */
const MAX_ACTIONS = 7;

/**
 * The Crisis Mitigator (a fan-made role): a turn's actions follow the cubes of every color in
 * their city when it starts: 0–1 cubes: 4, 2: 5, 3: 6, 4 or more: 7.
 */
export const crisisMitigator: RoleModule = {
  id: 'crisis-mitigator',
  actionsPerTurn(state, holder) {
    const cubes = state.cubes[state.pawns[holder] as CityId];
    const count = COLORS.reduce((sum, color) => sum + cubes[color], 0);
    return Math.min(MAX_ACTIONS, Math.max(ACTIONS_PER_TURN, count + 3));
  },
};
