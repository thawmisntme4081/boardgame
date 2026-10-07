// Where rooms and matches live between server restarts: SQLite on disk in production, memory
// in dev and tests. A room (the lobby: players, the current match) is one JSON row; each match
// is a log: its record (game, rules version, config, seed, outcome), who sat where, every
// accepted move, and snapshots of the state. A match loads as its latest snapshot plus the
// moves made after it. Socket ids and timers belong to one process and are never saved.
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Outcome } from '@platform/engine';
import Database from 'better-sqlite3';
import { and, asc, desc, eq, gt, inArray, lt } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { GameConfig } from './games';
import type { Match, Player, Room } from './rooms';

/**
 * The saved room format. Bump it when `StoredRoom` changes in a way old rows cannot be read
 * as: rooms saved in another format are dropped instead of loaded wrongly (format 3, Sky
 * Team 12's rooms with their whole game inside, is converted into a match log instead).
 */
export const ROOM_FORMAT = 4;
/** Sky Team 12 / Platform 02–03: the room row held the whole game state. */
const ROOM_FORMAT_WITH_GAME = 3;

/** Rejoin tokens are kept only as a hash: a copy of the database cannot take a seat. */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** A room as saved: everything but the connections, the timer and the game state. */
export interface StoredRoom {
  code: string;
  gameId: string;
  players: Partial<Record<Player['seat'], Omit<Player, 'socketId'>>>;
  config: GameConfig;
  match: Match;
  creatorIp: string;
  createdAt: number;
  lastActivity: number;
}

export type MatchStatus = 'open' | 'over' | 'abandoned';
export type EndedStatus = Exclude<MatchStatus, 'open'>;

export interface MatchRecord {
  id: string;
  roomCode: string;
  gameId: string;
  /** The game's `version` when the match started: a later one loads it through `migrate`. */
  rulesVersion: number;
  config: unknown;
  seed: number;
  status: MatchStatus;
  createdAt: number;
  endedAt: number | null;
  outcome: Outcome | null;
}

/** One accepted move; `n` is the match's version after it. */
export interface LoggedMove {
  n: number;
  move: unknown;
  by: string;
  at: number;
}

export interface MatchSeat {
  seat: string;
  name: string;
  tokenHash: string;
  /** The signed-in player's account (Platform 06), `null` for a guest. */
  userId: string | null;
}

/** One finished match in an account's Flight Log; `record` is the game's own JSON. */
export interface FlightEntry {
  userId: string;
  matchId: string;
  gameId: string;
  endedAt: number;
  record: unknown;
}

export interface Snapshot {
  n: number;
  state: unknown;
}

/** A match as loaded: its record, its latest snapshot, and the moves made after it. */
export interface LoadedMatch {
  match: MatchRecord;
  snapshot: Snapshot;
  moves: LoggedMove[];
}

export interface MatchStore {
  /** Every saved room in the current format (older ones are converted or dropped first). */
  loadRooms(): StoredRoom[];
  saveRoom(room: StoredRoom): void;
  deleteRoom(code: string): void;
  /** A new match, with its first snapshot (the state right after setup). */
  createMatch(match: MatchRecord, initial: Snapshot): void;
  /** Who sits in each seat (replaces the match's previous list). */
  saveSeats(matchId: string, seats: MatchSeat[]): void;
  appendMove(matchId: string, move: LoggedMove): void;
  saveSnapshot(matchId: string, snapshot: Snapshot): void;
  endMatch(
    matchId: string,
    status: Exclude<MatchStatus, 'open'>,
    outcome: Outcome | null,
    at: number,
  ): void;
  loadMatch(matchId: string): LoadedMatch | undefined;
  listOpen(): MatchRecord[];
  /** Adds entries to the accounts' Flight Logs; one that is already there (same match and account) is kept as it was. */
  addFlightEntries(entries: FlightEntry[]): void;
  /** An account's entries for a game, newest first. */
  flightLog(userId: string, gameId: string): FlightEntry[];
  /**
   * Deletes `gameId`'s matches that ended as `status` before `before`, with their seats, moves
   * and snapshots. Returns how many.
   */
  pruneEnded(gameId: string, status: EndedStatus, before: number): number;
  close(): void;
}

export function toStored(room: Room): StoredRoom {
  const players: StoredRoom['players'] = {};
  for (const [seat, player] of Object.entries(room.players)) {
    if (!player) continue;
    const saved: Partial<Player> = { ...player };
    delete saved.socketId;
    players[seat as Player['seat']] = saved as Omit<Player, 'socketId'>;
  }
  return {
    code: room.code,
    gameId: room.gameId,
    players,
    config: room.config,
    match: room.match,
    creatorIp: room.creatorIp,
    createdAt: room.createdAt,
    lastActivity: room.lastActivity,
  };
}

/** A loaded room with its restored game: every player offline until they rejoin. */
export function fromStored(stored: StoredRoom, game: Room['game']): Room {
  const players: Room['players'] = {};
  for (const [seat, player] of Object.entries(stored.players)) {
    if (player) players[seat as Player['seat']] = { ...player, socketId: null };
  }
  return { ...stored, players, game };
}

/**
 * A room row as Sky Team 12 (and Platforms 02–03) saved it, whole game included: the room in
 * the current format, plus its match as a log that starts from that game (a snapshot at the
 * match's version). `undefined` for rows too old to read.
 */
export function convertRoomWithGame(
  json: string,
  updatedAt: number,
): { room: StoredRoom; match: MatchRecord; snapshot: Snapshot } | undefined {
  const old = JSON.parse(json) as Omit<StoredRoom, 'players'> & {
    players: Record<string, (Omit<Player, 'socketId' | 'tokenHash'> & { token: string }) | null>;
    game: { rngSeed: number };
  };
  if (!old.match?.id || !old.game || !old.gameId) return undefined;
  const players: StoredRoom['players'] = {};
  for (const [seat, player] of Object.entries(old.players)) {
    if (!player) continue;
    const { token, ...rest } = player;
    players[seat] = { ...rest, tokenHash: hashToken(token) };
  }
  const room: StoredRoom = {
    code: old.code,
    gameId: old.gameId,
    players,
    config: old.config,
    match: old.match,
    creatorIp: old.creatorIp,
    createdAt: old.createdAt,
    lastActivity: old.lastActivity,
  };
  const match: MatchRecord = {
    id: old.match.id,
    roomCode: old.code,
    gameId: old.gameId,
    rulesVersion: 1,
    config: old.config,
    seed: old.game.rngSeed,
    status: 'open',
    createdAt: updatedAt,
    endedAt: null,
    outcome: null,
  };
  return { room, match, snapshot: { n: old.match.version, state: old.game } };
}

/** Keeps everything as JSON in maps: the same round trips as on disk, for dev and tests. */
export class MemoryMatchStore implements MatchStore {
  private readonly rooms = new Map<string, { json: string; version: number; updatedAt: number }>();
  private readonly matches = new Map<string, string>();
  private readonly seats = new Map<string, string>();
  private readonly moves = new Map<string, LoggedMove[]>();
  private readonly snapshots = new Map<string, Snapshot[]>();
  private readonly flight = new Map<string, FlightEntry>();

  loadRooms(): StoredRoom[] {
    const loaded: StoredRoom[] = [];
    for (const [code, row] of this.rooms) {
      if (row.version === ROOM_FORMAT) {
        loaded.push(JSON.parse(row.json) as StoredRoom);
        continue;
      }
      const converted =
        row.version === ROOM_FORMAT_WITH_GAME
          ? convertRoomWithGame(row.json, row.updatedAt)
          : undefined;
      if (!converted) {
        this.rooms.delete(code);
        continue;
      }
      this.createMatch(converted.match, converted.snapshot);
      this.saveRoom(converted.room);
      loaded.push(structuredClone(converted.room));
    }
    return loaded;
  }

  saveRoom(room: StoredRoom): void {
    this.rooms.set(room.code, {
      json: JSON.stringify(room),
      version: ROOM_FORMAT,
      updatedAt: Date.now(),
    });
  }

  deleteRoom(code: string): void {
    this.rooms.delete(code);
  }

  createMatch(match: MatchRecord, initial: Snapshot): void {
    this.matches.set(match.id, JSON.stringify(match));
    this.moves.set(match.id, []);
    this.snapshots.set(match.id, []);
    this.saveSnapshot(match.id, initial);
  }

  saveSeats(matchId: string, seats: MatchSeat[]): void {
    this.seats.set(matchId, JSON.stringify(seats));
  }

  appendMove(matchId: string, move: LoggedMove): void {
    this.moves.get(matchId)?.push(JSON.parse(JSON.stringify(move)) as LoggedMove);
  }

  saveSnapshot(matchId: string, snapshot: Snapshot): void {
    this.snapshots.get(matchId)?.push(JSON.parse(JSON.stringify(snapshot)) as Snapshot);
  }

  endMatch(
    matchId: string,
    status: Exclude<MatchStatus, 'open'>,
    outcome: Outcome | null,
    at: number,
  ): void {
    const json = this.matches.get(matchId);
    if (!json) return;
    const match = JSON.parse(json) as MatchRecord;
    this.matches.set(matchId, JSON.stringify({ ...match, status, outcome, endedAt: at }));
  }

  loadMatch(matchId: string): LoadedMatch | undefined {
    const json = this.matches.get(matchId);
    const snapshots = this.snapshots.get(matchId) ?? [];
    const snapshot = snapshots.reduce<Snapshot | undefined>(
      (a, b) => (!a || b.n >= a.n ? b : a),
      undefined,
    );
    if (!json || !snapshot) return undefined;
    const moves = (this.moves.get(matchId) ?? []).filter((m) => m.n > snapshot.n);
    return structuredClone({ match: JSON.parse(json) as MatchRecord, snapshot, moves });
  }

  listOpen(): MatchRecord[] {
    return [...this.matches.values()]
      .map((json) => JSON.parse(json) as MatchRecord)
      .filter((m) => m.status === 'open');
  }

  addFlightEntries(entries: FlightEntry[]): void {
    for (const e of entries) {
      const key = `${e.userId}\n${e.matchId}`;
      if (!this.flight.has(key)) this.flight.set(key, structuredClone(e));
    }
  }

  flightLog(userId: string, gameId: string): FlightEntry[] {
    return [...this.flight.values()]
      .filter((e) => e.userId === userId && e.gameId === gameId)
      .sort((a, b) => b.endedAt - a.endedAt)
      .map((e) => structuredClone(e));
  }

  pruneEnded(gameId: string, status: EndedStatus, before: number): number {
    let removed = 0;
    for (const [id, json] of this.matches) {
      const match = JSON.parse(json) as MatchRecord;
      if (match.gameId !== gameId || match.status !== status) continue;
      if ((match.endedAt ?? 0) >= before) continue;
      for (const table of [this.matches, this.seats, this.moves, this.snapshots]) table.delete(id);
      removed++;
    }
    return removed;
  }

  close(): void {}

  /** Tests: who sat where in a match. */
  seatsOf(matchId: string): MatchSeat[] {
    return JSON.parse(this.seats.get(matchId) ?? '[]') as MatchSeat[];
  }

  /** Tests: store a room row in another format, as an older server would have. */
  saveRaw(code: string, json: string, version: number): void {
    this.rooms.set(code, { json, version, updatedAt: Date.now() });
  }
}

export const roomsTable = sqliteTable('rooms', {
  code: text('code').primaryKey(),
  json: text('json').notNull(),
  version: integer('version').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const matchesTable = sqliteTable('matches', {
  id: text('id').primaryKey(),
  roomCode: text('room_code').notNull(),
  gameId: text('game_id').notNull(),
  rulesVersion: integer('rules_version').notNull(),
  config: text('config').notNull(),
  seed: integer('seed').notNull(),
  status: text('status').notNull(),
  createdAt: integer('created_at').notNull(),
  endedAt: integer('ended_at'),
  outcome: text('outcome'),
});

export const matchSeatsTable = sqliteTable(
  'match_seats',
  {
    matchId: text('match_id').notNull(),
    seat: text('seat').notNull(),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull(),
    userId: text('user_id'),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.seat] })],
);

export const matchMovesTable = sqliteTable(
  'match_moves',
  {
    matchId: text('match_id').notNull(),
    n: integer('n').notNull(),
    by: text('by').notNull(),
    move: text('move').notNull(),
    at: integer('at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.n] })],
);

export const matchSnapshotsTable = sqliteTable(
  'match_snapshots',
  {
    matchId: text('match_id').notNull(),
    n: integer('n').notNull(),
    state: text('state').notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.n] })],
);

export const flightLogTable = sqliteTable(
  'flight_log',
  {
    userId: text('user_id').notNull(),
    matchId: text('match_id').notNull(),
    gameId: text('game_id').notNull(),
    endedAt: integer('ended_at').notNull(),
    record: text('record').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.matchId] })],
);

/**
 * The schema, one step per version (SQLite's `user_version` says how many have run). Only
 * ever add steps at the end: a database already past a step never runs it again.
 */
export const MIGRATIONS: readonly string[] = [
  // 1. Sky Team 12: rooms as JSON rows.
  `CREATE TABLE IF NOT EXISTS rooms (
    code TEXT PRIMARY KEY NOT NULL,
    json TEXT NOT NULL,
    version INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  // 2. Platform 04: the match log.
  `CREATE TABLE matches (
    id TEXT PRIMARY KEY NOT NULL,
    room_code TEXT NOT NULL,
    game_id TEXT NOT NULL,
    rules_version INTEGER NOT NULL,
    config TEXT NOT NULL,
    seed INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    ended_at INTEGER,
    outcome TEXT
  );
  CREATE INDEX matches_status ON matches (status);
  CREATE TABLE match_seats (
    match_id TEXT NOT NULL,
    seat TEXT NOT NULL,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    PRIMARY KEY (match_id, seat)
  );
  CREATE TABLE match_moves (
    match_id TEXT NOT NULL,
    n INTEGER NOT NULL,
    by TEXT NOT NULL,
    move TEXT NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (match_id, n)
  );
  CREATE TABLE match_snapshots (
    match_id TEXT NOT NULL,
    n INTEGER NOT NULL,
    state TEXT NOT NULL,
    PRIMARY KEY (match_id, n)
  );`,
  // 3. Platform 06 B: accounts (Better Auth's tables, under our names; see accounts.ts).
  // Dates are Better Auth's own `date` columns; `auth_verifications` holds email sign-in codes.
  `CREATE TABLE users (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    email_verified INTEGER NOT NULL,
    image TEXT,
    created_at DATE NOT NULL,
    updated_at DATE NOT NULL
  );
  CREATE TABLE auth_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    expires_at DATE NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at DATE NOT NULL,
    updated_at DATE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE
  );
  CREATE INDEX auth_sessions_user_id_idx ON auth_sessions (user_id);
  CREATE TABLE auth_accounts (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at DATE,
    refresh_token_expires_at DATE,
    scope TEXT,
    password TEXT,
    created_at DATE NOT NULL,
    updated_at DATE NOT NULL
  );
  CREATE INDEX auth_accounts_user_id_idx ON auth_accounts (user_id);
  CREATE TABLE auth_verifications (
    id TEXT PRIMARY KEY NOT NULL,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at DATE NOT NULL,
    created_at DATE NOT NULL,
    updated_at DATE NOT NULL
  );
  CREATE INDEX auth_verifications_identifier_idx ON auth_verifications (identifier);`,
  // 4. Platform 06 D: a seat names the account that held it (guests: NULL).
  `ALTER TABLE match_seats ADD COLUMN user_id TEXT;
  CREATE INDEX match_seats_user_id ON match_seats (user_id);`,
  // 5. Platform 06 E: each account's Flight Log, one row per account and finished match. It
  // outlives the match log, which is pruned (no foreign key: account deletion removes rows).
  `CREATE TABLE flight_log (
    user_id TEXT NOT NULL,
    match_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    ended_at INTEGER NOT NULL,
    record TEXT NOT NULL,
    PRIMARY KEY (user_id, match_id)
  );
  CREATE INDEX flight_log_user_game ON flight_log (user_id, game_id, ended_at);`,
];

/** Runs the migrations a database has not had yet, each in its own transaction. */
export function migrate(sqlite: Database.Database): void {
  const done = sqlite.pragma('user_version', { simple: true }) as number;
  MIGRATIONS.slice(done).forEach((sql, i) => {
    sqlite.transaction(() => {
      sqlite.exec(sql);
      sqlite.pragma(`user_version = ${done + i + 1}`);
    })();
  });
}

const toRecord = (row: typeof matchesTable.$inferSelect): MatchRecord => ({
  id: row.id,
  roomCode: row.roomCode,
  gameId: row.gameId,
  rulesVersion: row.rulesVersion,
  config: JSON.parse(row.config) as unknown,
  seed: row.seed,
  status: row.status as MatchStatus,
  createdAt: row.createdAt,
  endedAt: row.endedAt,
  outcome: row.outcome === null ? null : (JSON.parse(row.outcome) as Outcome),
});

/**
 * The platform's database (WAL mode, every migration run): the match store and the accounts
 * share one connection. `:memory:` when nothing is saved (dev without `DATA_DIR`, tests).
 */
export function openDatabase(file: string): Database.Database {
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  migrate(sqlite);
  return sqlite;
}

/** SQLite through Drizzle (WAL mode); a later move to Postgres swaps the driver. */
export class SqliteMatchStore implements MatchStore {
  private readonly sqlite: Database.Database;
  private readonly db: BetterSQLite3Database;

  /** A database file, or a connection from `openDatabase` shared with the accounts. */
  constructor(database: string | Database.Database) {
    this.sqlite = typeof database === 'string' ? openDatabase(database) : database;
    this.db = drizzle(this.sqlite);
  }

  loadRooms(): StoredRoom[] {
    const loaded: StoredRoom[] = [];
    for (const row of this.db.select().from(roomsTable).all()) {
      if (row.version === ROOM_FORMAT) {
        loaded.push(JSON.parse(row.json) as StoredRoom);
        continue;
      }
      const converted =
        row.version === ROOM_FORMAT_WITH_GAME
          ? convertRoomWithGame(row.json, row.updatedAt)
          : undefined;
      if (!converted) {
        this.deleteRoom(row.code);
        continue;
      }
      this.sqlite.transaction(() => {
        this.createMatch(converted.match, converted.snapshot);
        this.saveRoom(converted.room);
      })();
      loaded.push(converted.room);
    }
    return loaded;
  }

  saveRoom(room: StoredRoom): void {
    const values = {
      code: room.code,
      json: JSON.stringify(room),
      version: ROOM_FORMAT,
      updatedAt: Date.now(),
    };
    this.db
      .insert(roomsTable)
      .values(values)
      .onConflictDoUpdate({ target: roomsTable.code, set: values })
      .run();
  }

  deleteRoom(code: string): void {
    this.db.delete(roomsTable).where(eq(roomsTable.code, code)).run();
  }

  createMatch(match: MatchRecord, initial: Snapshot): void {
    this.sqlite.transaction(() => {
      this.db
        .insert(matchesTable)
        .values({
          ...match,
          config: JSON.stringify(match.config),
          outcome: match.outcome === null ? null : JSON.stringify(match.outcome),
        })
        .run();
      this.saveSnapshot(match.id, initial);
    })();
  }

  saveSeats(matchId: string, seats: MatchSeat[]): void {
    this.sqlite.transaction(() => {
      this.db.delete(matchSeatsTable).where(eq(matchSeatsTable.matchId, matchId)).run();
      if (seats.length > 0) {
        this.db
          .insert(matchSeatsTable)
          .values(seats.map((s) => ({ matchId, ...s })))
          .run();
      }
    })();
  }

  appendMove(matchId: string, move: LoggedMove): void {
    this.db
      .insert(matchMovesTable)
      .values({ matchId, n: move.n, by: move.by, at: move.at, move: JSON.stringify(move.move) })
      .run();
  }

  saveSnapshot(matchId: string, snapshot: Snapshot): void {
    const values = { matchId, n: snapshot.n, state: JSON.stringify(snapshot.state) };
    this.db
      .insert(matchSnapshotsTable)
      .values(values)
      .onConflictDoUpdate({
        target: [matchSnapshotsTable.matchId, matchSnapshotsTable.n],
        set: { state: values.state },
      })
      .run();
  }

  endMatch(
    matchId: string,
    status: Exclude<MatchStatus, 'open'>,
    outcome: Outcome | null,
    at: number,
  ): void {
    this.db
      .update(matchesTable)
      .set({ status, endedAt: at, outcome: outcome === null ? null : JSON.stringify(outcome) })
      .where(eq(matchesTable.id, matchId))
      .run();
  }

  loadMatch(matchId: string): LoadedMatch | undefined {
    const row = this.db.select().from(matchesTable).where(eq(matchesTable.id, matchId)).get();
    const snap = this.db
      .select()
      .from(matchSnapshotsTable)
      .where(eq(matchSnapshotsTable.matchId, matchId))
      .orderBy(desc(matchSnapshotsTable.n))
      .limit(1)
      .get();
    if (!row || !snap) return undefined;
    const moves = this.db
      .select()
      .from(matchMovesTable)
      .where(and(eq(matchMovesTable.matchId, matchId), gt(matchMovesTable.n, snap.n)))
      .orderBy(asc(matchMovesTable.n))
      .all()
      .map((m) => ({ n: m.n, by: m.by, at: m.at, move: JSON.parse(m.move) as unknown }));
    return {
      match: toRecord(row),
      snapshot: { n: snap.n, state: JSON.parse(snap.state) as unknown },
      moves,
    };
  }

  listOpen(): MatchRecord[] {
    return this.db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.status, 'open'))
      .all()
      .map(toRecord);
  }

  addFlightEntries(entries: FlightEntry[]): void {
    if (entries.length === 0) return;
    this.db
      .insert(flightLogTable)
      .values(entries.map((e) => ({ ...e, record: JSON.stringify(e.record) })))
      .onConflictDoNothing()
      .run();
  }

  flightLog(userId: string, gameId: string): FlightEntry[] {
    return this.db
      .select()
      .from(flightLogTable)
      .where(and(eq(flightLogTable.userId, userId), eq(flightLogTable.gameId, gameId)))
      .orderBy(desc(flightLogTable.endedAt))
      .all()
      .map((r) => ({ ...r, record: JSON.parse(r.record) as unknown }));
  }

  pruneEnded(gameId: string, status: EndedStatus, before: number): number {
    const old = and(
      eq(matchesTable.gameId, gameId),
      eq(matchesTable.status, status),
      lt(matchesTable.endedAt, before),
    );
    const ids = this.db.select({ id: matchesTable.id }).from(matchesTable).where(old).all();
    if (ids.length === 0) return 0;
    const list = ids.map((r) => r.id);
    this.sqlite.transaction(() => {
      this.db.delete(matchSeatsTable).where(inArray(matchSeatsTable.matchId, list)).run();
      this.db.delete(matchMovesTable).where(inArray(matchMovesTable.matchId, list)).run();
      this.db.delete(matchSnapshotsTable).where(inArray(matchSnapshotsTable.matchId, list)).run();
      this.db.delete(matchesTable).where(inArray(matchesTable.id, list)).run();
    })();
    return list.length;
  }

  close(): void {
    this.sqlite.close();
  }
}

/** The database file inside `DATA_DIR` (the Fly volume in production). */
export const databaseFile = (dataDir: string): string => path.join(dataDir, 'boardgames.sqlite');
