import type { EndReason, GameState } from '../types';
import type { RuleModule } from './types';

/** The Kerosene marker starts at 20; the X below 1 means the tanks are empty. */
export const KEROSENE_START = 20;
/** Kerosene lost at the end of a round with no die on the Kerosene space. */
export const KEROSENE_IDLE_LOSS = 6;

/** Moves the Kerosene marker down; reaching the X (0) at any time loses the game. */
export function burnKerosene(state: GameState, amount: number): EndReason | undefined {
  state.kerosene = Math.max(0, (state.kerosene ?? 0) - amount);
  return state.kerosene === 0 ? 'kerosene' : undefined;
}

/** Kerosene: a die of any value on the Kerosene space burns that much fuel; no die burns 6. */
export const kerosene: RuleModule = {
  id: 'kerosene',
  setup(state) {
    state.kerosene = KEROSENE_START;
  },
  place(state, _seat, _slot, value) {
    return burnKerosene(state, value);
  },
  endOfRound(state) {
    return state.placed.kerosene ? undefined : burnKerosene(state, KEROSENE_IDLE_LOSS);
  },
};

/** Kerosene leak: no Kerosene space; each round burns the engine dice's difference + 1. */
export const keroseneLeak: RuleModule = {
  id: 'kerosene-leak',
  setup(state) {
    state.kerosene = KEROSENE_START;
  },
  endOfRound(state) {
    const pilot = state.placed.enginePilot;
    const copilot = state.placed.engineCopilot;
    if (!pilot || !copilot) return undefined;
    return burnKerosene(state, Math.abs(pilot.value - copilot.value) + 1);
  },
};
