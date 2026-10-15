import type { RuleModule } from './types';

export const WIND_RING: readonly number[] = [
  3, 3, 2, 2, 1, 0, -1, -2, -2, -3, -3, -3, -2, -2, -1, 0, 1, 2, 2, 3,
];

export const windSpeed = (wind: number | null): number => (wind === null ? 0 : WIND_RING[wind]!);

/**
 * Wind: after each Axis phase the blue airplane turns as many spaces as the axis is off
 * center, to the side it tilts (negative: left, toward the pilot), even if the axis did not move; the wind speed
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

/** Where the airplane starts on the ring when the Wind module is placed upside down. */
export const WIND_REVERSED_START = WIND_RING.length / 2;

/**
 * Wind upside down (Turbulence, NZIR): the Wind module is placed the other way round, so the
 * airplane starts on the opposite side of the ring. The ring is symmetric (the opposite space
 * holds the negated value), so every wind speed is reversed: tailwinds become headwinds.
 */
export const windReversed: RuleModule = {
  ...wind,
  id: 'wind-reversed',
  setup(state) {
    state.wind = WIND_REVERSED_START;
  },
};
