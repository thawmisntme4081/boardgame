import type { RuleModule } from './types';

/**
 * Altitude 5000 (Turbulence): the game starts with the 5000 space in the Current Altitude
 * space instead of 6000, so the starting reroll token is lost and there is one round fewer.
 */
export const altitude5000: RuleModule = {
  id: 'altitude-5000',
  altitudes: (altitudes) => altitudes.slice(1),
};
