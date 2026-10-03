import type { RuleModule } from './types';

/**
 * Engines out (Turbulence, TER Lajes): out of fuel, the plane glides. The Engine spaces are
 * covered (no dice, not mandatory, no speed); each player rolls 4 dice but places only 3;
 * at the end of every round the Approach Track advances one space (planes still on the
 * space are a collision, and turns still apply). Landing has no speed check.
 */
export const enginesOut: RuleModule = {
  id: 'engines-out',
  dicePerRound: 3,
  approachPerRound: 1,
  waivedLanding: ['landing-brakes'],
};
