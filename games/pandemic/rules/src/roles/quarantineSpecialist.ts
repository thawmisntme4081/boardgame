import { cityOf } from '../cities';
import type { RoleModule } from './types';

/**
 * No cube is put on the Quarantine Specialist's city or the cities connected to it, in any
 * infection (infection cards, epidemics, outbreaks); an outbreak into one of them places nothing
 * there and does not chain from it.
 */
export const quarantineSpecialist: RoleModule = {
  id: 'quarantine-specialist',
  preventsCube(state, holder, city) {
    const here = state.pawns[holder];
    return here !== undefined && (here === city || cityOf(here).links.includes(city));
  },
};
