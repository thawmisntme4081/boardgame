import { describe, expect, it } from 'vitest';
import { nextRandom, rollDie } from './rng';

function rolls(seed: number, n: number): number[] {
  const out: number[] = [];
  let state = seed;
  for (let i = 0; i < n; i++) {
    const r = rollDie(state);
    out.push(r.value);
    state = r.rngState;
  }
  return out;
}

describe('rng', () => {
  it('is deterministic for a seed', () => {
    expect(rolls(123, 50)).toEqual(rolls(123, 50));
  });

  it('gives different sequences for different seeds', () => {
    expect(rolls(1, 20)).not.toEqual(rolls(2, 20));
  });

  it('returns floats in [0, 1)', () => {
    let state = 7;
    for (let i = 0; i < 1000; i++) {
      const r = nextRandom(state);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      state = r.rngState;
    }
  });

  it('rolls every face from 1 to 6 and nothing else', () => {
    const counts = new Map<number, number>();
    for (const v of rolls(99, 6000)) counts.set(v, (counts.get(v) ?? 0) + 1);
    expect([...counts.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1150);
    }
  });
});
