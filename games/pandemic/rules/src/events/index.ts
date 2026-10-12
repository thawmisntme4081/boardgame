// The five event cards of the base game, by id. Each card's effect is a module (`EventModule`).
import type { EventId } from '../types';
import { airlift } from './airlift';
import { forecast } from './forecast';
import { governmentGrant } from './governmentGrant';
import { oneQuietNight } from './oneQuietNight';
import { resilientPopulation } from './resilientPopulation';
import type { EventModule } from './types';

export * from './types';
export { FORECAST_CARDS, applyForecastOrder, checkForecastOrder } from './forecast';
export type { ForecastOrderMove } from './forecast';

export const EVENTS: Readonly<Record<EventId, EventModule>> = {
  airlift,
  forecast,
  'government-grant': governmentGrant,
  'one-quiet-night': oneQuietNight,
  'resilient-population': resilientPopulation,
};
