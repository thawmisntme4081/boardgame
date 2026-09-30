import type { RuleModule } from './types';

/**
 * Wind speed on each Wind Ring space, clockwise from the white centre (index 0).
 * PLACEHOLDER: the Flight Log only shows a +2 space; read the real values off the ring.
 */
export const WIND_RING: readonly number[] = [3, 2, 2, 1, 1, 0, -1, 0, 1, 1, 2, 2];

export const windSpeed = (wind: number | null): number => (wind === null ? 0 : WIND_RING[wind]!);

/**
 * Wind: after each Axis phase the blue airplane turns as many spaces as the axis is off
 * centre (toward the pilot = to the left), even if the axis did not move; the wind speed
 * it points at is added to the engines every round, the last one included.
 */
export const wind: RuleModule = {
  id: 'wind',
  setup(state) {
    state.wind = 0;
  },
  afterAxis(state) {
    const n = WIND_RING.length;
    state.wind = ((((state.wind ?? 0) - state.axis) % n) + n) % n;
  },
  speedBonus(state) {
    return windSpeed(state.wind);
  },
};
