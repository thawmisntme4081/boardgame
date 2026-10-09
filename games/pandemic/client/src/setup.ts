import { MIN_PLAYERS } from '@pandemic/rules';
import type { PandemicLobby } from '@pandemic/rules/definition';

/** The lobby's starting choice for a new Pandemic game. */
export const DEFAULT_SETUP: PandemicLobby = { players: MIN_PLAYERS };
