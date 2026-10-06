import { nextRandom } from '@platform/engine';
import type { DieValue } from './types';

// The seeded RNG lives in the engine (every game uses it); Sky Team adds its six-sided die.
export { nextRandom, randomSeed } from '@platform/engine';

export function rollDie(rngState: number): { value: DieValue; rngState: number } {
  const r = nextRandom(rngState);
  return { value: (Math.floor(r.value * 6) + 1) as DieValue, rngState: r.rngState };
}
