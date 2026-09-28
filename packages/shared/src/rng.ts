import type { DieValue } from './types';

/** One mulberry32 step: returns a float in [0, 1) and the next RNG state. */
export function nextRandom(rngState: number): { value: number; rngState: number } {
  const next = (rngState + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, rngState: next };
}

export function rollDie(rngState: number): { value: DieValue; rngState: number } {
  const r = nextRandom(rngState);
  return { value: (Math.floor(r.value * 6) + 1) as DieValue, rngState: r.rngState };
}

/** A random 32-bit seed for a new game (not for tests, which pass fixed seeds). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32) | 0;
}
