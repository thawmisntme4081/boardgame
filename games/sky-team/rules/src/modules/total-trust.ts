import type { RuleModule } from './types';

/**
 * Total Trust (Turbulence): when a round ends with the plane on a Total Trust space, the
 * next round has no strategy discussion; in the app its dice roll by themselves after the
 * "Next turn" pause (the server rolls them, see `autoRoll`).
 */
export const totalTrust: RuleModule = {
  id: 'total-trust',
  startOfRound(state) {
    state.autoRoll = state.round > 1 && (state.scenario.totalTrust?.[state.approachIndex] ?? 0) > 0;
  },
};
