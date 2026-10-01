import type { RuleModule } from './types';

export const WIND_RING: readonly number[] = [
  3, 3, 2, 2, 1, 0, -1, -2, -2, -3, -3, -3, -2, -2, -1, 0, 1, 2, 2, 3,
];

export const windSpeed = (wind: number | null): number => (wind === null ? 0 : WIND_RING[wind]!);

/**
 * Wind: after each Axis phase the blue airplane turns as many spaces as the axis is off
 * centre, to the side it tilts (negative: left, toward the pilot), even if the axis did not move; the wind speed
 * it points at is added to the engines every round, the last one included.
 */
export const wind: RuleModule = {
  id: 'wind',
  setup(state) {
    state.wind = 0;
  },
  afterAxis(state) {
    const n = WIND_RING.length;
    state.wind = ((((state.wind ?? 0) + state.axis) % n) + n) % n;
  },
  speedBonus(state) {
    return windSpeed(state.wind);
  },
};
