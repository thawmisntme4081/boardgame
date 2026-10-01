// The Flight Log's game modules as rule hooks (see `RuleModule`).
import type { ModuleId, Scenario } from '../types';
import { altitude5000 } from './altitude-5000';
import { enginesOut } from './engines-out';
import { iceBrakes } from './ice-brakes';
import { intern } from './intern';
import { kerosene, keroseneLeak } from './kerosene';
import type { RuleModule } from './types';
import { wind, windReversed } from './wind';

/** Real-time: a 60-second round from the roll; when it runs out, unplaced dice are lost. */
export const REAL_TIME_MS = 60_000;

const realTime: RuleModule = {
  id: 'real-time',
  setup(state) {
    state.timerMs = REAL_TIME_MS;
  },
  timeUpEndsRound: true,
};

export const MODULES: Record<ModuleId, RuleModule> = {
  kerosene,
  'kerosene-leak': keroseneLeak,
  intern,
  wind,
  'wind-reversed': windReversed,
  'real-time': realTime,
  'ice-brakes': iceBrakes,
  'altitude-5000': altitude5000,
  'engines-out': enginesOut,
};

export const MODULE_IDS = Object.keys(MODULES) as ModuleId[];

/** The hooks of a scenario's modules, in the scenario's order. */
export const modulesOf = (scenario: Pick<Scenario, 'modules'>): RuleModule[] =>
  scenario.modules.map((id) => MODULES[id]);

export type { Resolver, RuleModule, SlotCheck } from './types';
export { ICE_BRAKE_COLUMNS } from './ice-brakes';
export { INTERN_TOKENS, nextInternToken } from './intern';
export { burnKerosene, KEROSENE_IDLE_LOSS, KEROSENE_START } from './kerosene';
export { WIND_RING, WIND_REVERSED_START, windSpeed } from './wind';
