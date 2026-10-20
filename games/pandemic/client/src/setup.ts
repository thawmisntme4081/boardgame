import { EPIDEMIC_COUNTS, MIN_PLAYERS } from '@pandemic/rules';
import type { PandemicLobby } from '@pandemic/rules/definition';

/** The lobby's starting choice for a new Pandemic game: introductory, roles dealt at random. */
export const DEFAULT_SETUP: PandemicLobby = {
  players: MIN_PLAYERS,
  epidemics: EPIDEMIC_COUNTS[0] as number,
  roleMode: 'random',
};
