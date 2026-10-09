// The game registry: the only place the platform code learns which games it hosts. A room
// names its game by id; the lobby's choices and the server's own settings make its config.
import type { GameDefinition } from '@platform/engine';
import { armAutoRoll, recordOf } from '@sky/rules';
import { pandemic, pandemicLobbySchema } from '@pandemic/rules/definition';
import { skyTeam, skyTeamLobbySchema, type SkyTeamConfig } from '@sky/rules/definition';
import { z, type ZodType } from 'zod';
import type { EndedStatus } from './store';

// At the platform's edge every game looks the same: its state, moves and views are `unknown`
// and its config a plain object. Only the game's own definition and schemas look inside them,
// so the platform code (rooms, store, handlers) never depends on one game's types.
export type GameState = unknown;
export type GameMove = unknown;
export type GameView = unknown;
export type GameConfig = Record<string, unknown>;

/**
 * A game's registry entry with its own types (S state, M move, V view, C config). `register`
 * erases them into a `GameEntry`, the only shape the platform sees.
 */
export interface TypedGameEntry<S, M, V, C extends GameConfig> {
  definition: GameDefinition<S, M, V, C>;
  /** What a player may choose in the lobby (or when asking for a rematch). */
  lobby: ZodType<Partial<C>>;
  /** The server's own settings for this game (round lengths…); players cannot change them. */
  settings: Partial<C>;
  /**
   * How long an ended match stays in the store, by how it ended; then it is deleted, log and
   * all. A status left out is kept for good (long games played over days must not lose one).
   */
  keepEnded?: Partial<Record<EndedStatus, number>>;
  /**
   * Rooms of this game that nobody is connected to are removed after this long without
   * activity; without it, the server's default (`ROOM_TTL_MINUTES`, 30 minutes).
   */
  idleTtlMs?: number;
  /**
   * A seat's entry in its account's Flight Log, from its final view: `others` are the other
   * players' names. A game without one keeps no Flight Log.
   */
  flightRecord?(view: V, others: string[], at: number): unknown;
  /**
   * A record a device kept before its owner signed in: the checked record and its end time, or
   * `undefined` when it is not a valid one. Without it, a game's records cannot be imported.
   */
  importRecord?(raw: unknown): { record: unknown; at: number } | undefined;
  /**
   * Test-only (`E2E_HOOKS`): the state after merging `patch` into `game` at `now`, so an end-to-end
   * test can start from a prepared position. Without it, the game has no test route.
   */
  e2ePatch?(game: S, patch: Partial<S>, now: number): S;
}

/** A registry entry as the platform sees it: every game-specific type is `unknown`. */
export type GameEntry = TypedGameEntry<GameState, GameMove, GameView, GameConfig>;

/** Erases a game's types for the platform. The game's own schemas still check every input. */
export function register<S, M, V, C extends GameConfig>(
  entry: TypedGameEntry<S, M, V, C>,
): GameEntry {
  return entry as unknown as GameEntry;
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

/** Pandemic games are long and may pause: an empty room waits a day before it goes. */
const PANDEMIC_IDLE_TTL_MS = DAY_MS;

export type GameRegistry = ReadonlyMap<string, GameEntry>;

/** Server settings per game id, e.g. `{ 'sky-team': { roundTimerMs: 5000 } }` in tests. */
export type GameSettings = Partial<Record<string, GameConfig>>;

export function createRegistry(settings: GameSettings = {}): GameRegistry {
  return new Map<string, GameEntry>([
    [
      skyTeam.id,
      register({
        definition: skyTeam,
        lobby: skyTeamLobbySchema,
        settings: (settings[skyTeam.id] ?? {}) as Partial<SkyTeamConfig>,
        keepEnded: SKY_TEAM_KEEP_ENDED,
        flightRecord: (view, others, at) => recordOf(view, others[0] ?? '', at),
        importRecord: (raw) => {
          const parsed = skyTeamRecord.safeParse(raw);
          return parsed.success ? { record: parsed.data, at: parsed.data.at } : undefined;
        },
        // A prepared Total Trust strategy phase still rolls by itself.
        e2ePatch: (game, patch, now) => armAutoRoll({ ...game, ...patch }, now),
      }),
    ],
    [
      pandemic.id,
      register({
        definition: pandemic,
        lobby: pandemicLobbySchema,
        settings: settings[pandemic.id] ?? {},
        // Kept like Sky Team's ended matches.
        keepEnded: SKY_TEAM_KEEP_ENDED,
        idleTtlMs: PANDEMIC_IDLE_TTL_MS,
      }),
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
  base: GameConfig = {},
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
