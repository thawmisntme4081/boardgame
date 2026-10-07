// The game registry: the only place the platform code learns which games it hosts. A room
// names its game by id; the lobby's choices and the server's own settings make its config.
import type { GameDefinition } from '@platform/engine';
import type { GameState as SkyTeamState } from '@sky/rules';
import {
  skyTeam,
  skyTeamLobbySchema,
  type SkyTeamConfig,
  type SkyTeamMove,
} from '@sky/rules/definition';
import { recordOf, type PlayerView } from '@sky/rules';
import { z, type ZodType } from 'zod';
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
  /**
   * A seat's entry in its account's Flight Log, from its final view: `others` are the other
   * players' names. A game without one keeps no Flight Log.
   */
  flightRecord?(view: GameView, others: string[], at: number): unknown;
  /**
   * A record a device kept before its owner signed in: the checked record and its end time, or
   * `undefined` when it is not a valid one. Without it, a game's records cannot be imported.
   */
  importRecord?(raw: unknown): { record: unknown; at: number } | undefined;
}

const skyTeamRecord = z.object({
  v: z.literal(1),
  scenario: z.string().max(40),
  seat: z.enum(['pilot', 'copilot']),
  partner: z.string().max(40),
  abilities: z.array(z.string().max(40)).max(4),
  result: z.enum(['won', 'lost']),
  reasons: z.array(z.string().max(40)).max(10),
  rounds: z.number().int().min(0).max(100),
  at: z.number().int().positive(),
});

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
        flightRecord: (view, others, at) => recordOf(view, others[0] ?? '', at),
        importRecord: (raw) => {
          const parsed = skyTeamRecord.safeParse(raw);
          return parsed.success ? { record: parsed.data, at: parsed.data.at } : undefined;
        },
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
