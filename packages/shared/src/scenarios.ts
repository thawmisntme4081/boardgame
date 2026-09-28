import type { AltitudeSpace, Scenario } from './types';

/** Green/yellow side of the altitude track: first player alternates, rerolls at 6000 and 2000. */
export const BASE_ALTITUDES: AltitudeSpace[] = [
  { altitude: 6000, first: 'pilot', reroll: true },
  { altitude: 5000, first: 'copilot', reroll: false },
  { altitude: 4000, first: 'pilot', reroll: false },
  { altitude: 3000, first: 'copilot', reroll: false },
  { altitude: 2000, first: 'pilot', reroll: true },
  { altitude: 1000, first: 'copilot', reroll: false },
  { altitude: 0, first: 'pilot', reroll: false },
];

export const YUL: Scenario = {
  id: 'yul',
  name: 'YUL Montréal-Trudeau',
  altitudes: BASE_ALTITUDES,
  approach: [0, 0, 1, 2, 1, 3, 2],
};

export const SCENARIOS: Record<string, Scenario> = {
  [YUL.id]: YUL,
};
