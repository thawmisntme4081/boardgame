import type { RuleModule } from './types';

/**
 * Belly landing (Turbulence, WAW Warsaw): the landing gear is stuck. Intern tokens cover the
 * Landing Gear spaces (no dice there, so the blue Aerodynamics marker never moves), and the
 * gear is not needed to land. Only the Flaps, Co-Pilot Radio and Concentration Alarm tokens
 * are used.
 */
export const bellyLanding: RuleModule = {
  id: 'belly-landing',
  waivedLanding: ['landing-gear'],
  alarmTokens: ['flaps', 'radioCopilot', 'concentration'],
};
