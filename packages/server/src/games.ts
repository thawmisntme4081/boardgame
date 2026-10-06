// The game registry: the only place the platform code learns which games it hosts. A room
// names its game by id; the lobby's choices and the server's own settings make its config.
import type { GameDefinition } from '@platform/engine';
import type { GameState as SkyTeamState } from '@sky/shared';
import {
  skyTeam,
  skyTeamLobbySchema,
  type SkyTeamConfig,
  type SkyTeamMove,
} from '@sky/shared/definition';
import type { PlayerView } from '@sky/shared';
import type { ZodType } from 'zod';
import type { EndedStatus } from './store';

// One game for now, so the platform's types are its types. The Second game epic widens them
// (each room then carries its game's types behind the registry).
export type GameState = SkyTeamState;
export type GameMove = SkyTeamMove;
export type GameConfig = SkyTeamConfig;
export type GameView = PlayerView;

export interface GameEntry {
  definition: GameDefinition<GameState, GameMove, GameView, GameConfig>;
  /** What a player may choose in the lobby (or when asking for a rematch). */
  lobby: ZodType<Partial<GameConfig>>;
  /** The server's own settings for this game (round lengths…); players cannot change them. */
  settings: Partial<GameConfig>;
  /**
   * How long an ended match stays in the store, by how it ended; then it is deleted, log and
   * all. A status left out is kept for good (long games played over days must not lose one).
   */
  keepEnded?: Partial<Record<EndedStatus, number>>;
}

const DAY_MS = 24 * 60 * 60_000;

/**
 * Sky Team is played in one sitting, and each player's Flight Log keeps their own record: an
 * unfinished game goes after a day, a finished one after 30 days (time to look into a bug).
 */
const SKY_TEAM_KEEP_ENDED = { abandoned: DAY_MS, over: 30 * DAY_MS };

export type GameRegistry = ReadonlyMap<string, GameEntry>;

/** Server settings per game id, e.g. `{ 'sky-team': { roundTimerMs: 5000 } }` in tests. */
export type GameSettings = Partial<Record<string, Partial<GameConfig>>>;

export function createRegistry(settings: GameSettings = {}): GameRegistry {
  return new Map<string, GameEntry>([
    [
      skyTeam.id,
      {
        definition: skyTeam,
        lobby: skyTeamLobbySchema,
        settings: settings[skyTeam.id] ?? {},
        keepEnded: SKY_TEAM_KEEP_ENDED,
      },
    ],
  ]);
}

/**
 * The config for a new match: the lobby's choices (`request`, checked by the game's lobby
 * schema) over `base` (the room's last config, for a rematch), with the server's settings on
 * top. `undefined` when the request is not valid.
 */
export function configFor(
  entry: GameEntry,
  request: unknown,
  base: Partial<GameConfig> = {},
): GameConfig | undefined {
  const choices = entry.lobby.safeParse(request ?? {});
  if (!choices.success) return undefined;
  const config = entry.definition.configSchema.safeParse({
    ...base,
    ...choices.data,
    ...entry.settings,
  });
  return config.success ? config.data : undefined;
}
