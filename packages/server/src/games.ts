// The game registry: the only place the platform code learns which game it hosts. One game
// for now; the generic protocol (Platform 03) picks a definition by id.
import { skyTeam, type SkyTeamConfig, type SkyTeamMove } from '@sky/shared/definition';
import type { GameState as SkyTeamState } from '@sky/shared';

export const game = skyTeam;

export type GameState = SkyTeamState;
export type GameMove = SkyTeamMove;
export type GameConfig = SkyTeamConfig;
