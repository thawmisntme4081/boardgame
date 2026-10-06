// Where rooms live between server restarts: SQLite on disk in production, memory in dev and
// tests. Rooms are saved whole (players, rejoin tokens, game state) as JSON; socket ids and
// timers belong to one process and are never saved.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { GameState } from '@sky/shared';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Player, Room } from './rooms';

/**
 * The saved room format. Bump it when `StoredRoom` (or `GameState`) changes in a way old
 * rows cannot be read as: rooms saved in another format are dropped instead of loaded wrongly.
 */
export const ROOM_FORMAT = 1;

/** A room as saved: everything but the connection and the in-process timer. */
export interface StoredRoom {
  code: string;
  players: Partial<Record<Player['seat'], Omit<Player, 'socketId'>>>;
  game: GameState;
  creatorIp: string;
  createdAt: number;
  lastActivity: number;
  timed: boolean;
  rolesChosen: boolean;
  autoRollAt?: number;
}

export interface RoomStore {
  /** Every saved room in the current format; rows in another format are deleted. */
  loadAll(): StoredRoom[];
  save(room: StoredRoom): void;
  delete(code: string): void;
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
    players,
    game: room.game,
    creatorIp: room.creatorIp,
    createdAt: room.createdAt,
    lastActivity: room.lastActivity,
    timed: room.timed,
    rolesChosen: room.rolesChosen,
    ...(room.autoRollAt !== undefined && { autoRollAt: room.autoRollAt }),
  };
}

/** A loaded room: every player offline until they rejoin with their token. */
export function fromStored(stored: StoredRoom): Room {
  const players: Room['players'] = {};
  for (const [seat, player] of Object.entries(stored.players)) {
    if (player) players[seat as Player['seat']] = { ...player, socketId: null };
  }
  return { ...stored, players };
}

/** Keeps rooms as JSON in a map: the same round trip as on disk, for dev and tests. */
export class MemoryRoomStore implements RoomStore {
  private readonly rows = new Map<string, { json: string; version: number }>();

  loadAll(): StoredRoom[] {
    const rooms: StoredRoom[] = [];
    for (const [code, row] of this.rows) {
      if (row.version === ROOM_FORMAT) rooms.push(JSON.parse(row.json) as StoredRoom);
      else this.rows.delete(code);
    }
    return rooms;
  }

  save(room: StoredRoom): void {
    this.rows.set(room.code, { json: JSON.stringify(room), version: ROOM_FORMAT });
  }

  delete(code: string): void {
    this.rows.delete(code);
  }

  close(): void {}

  /** Tests: store a row in another format, as an older server would have. */
  saveRaw(code: string, json: string, version: number): void {
    this.rows.set(code, { json, version });
  }
}

export const roomsTable = sqliteTable('rooms', {
  code: text('code').primaryKey(),
  json: text('json').notNull(),
  version: integer('version').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** SQLite through Drizzle (WAL mode); a later move to Postgres swaps the driver. */
export class SqliteRoomStore implements RoomStore {
  private readonly sqlite: Database.Database;
  private readonly db: BetterSQLite3Database;

  constructor(file: string) {
    if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
    this.sqlite = new Database(file);
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.exec(
      `CREATE TABLE IF NOT EXISTS rooms (
        code TEXT PRIMARY KEY NOT NULL,
        json TEXT NOT NULL,
        version INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    );
    this.db = drizzle(this.sqlite);
  }

  loadAll(): StoredRoom[] {
    const rows = this.db.select().from(roomsTable).all();
    const rooms: StoredRoom[] = [];
    for (const row of rows) {
      if (row.version === ROOM_FORMAT) rooms.push(JSON.parse(row.json) as StoredRoom);
      else this.delete(row.code);
    }
    return rooms;
  }

  save(room: StoredRoom): void {
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

  delete(code: string): void {
    this.db.delete(roomsTable).where(eq(roomsTable.code, code)).run();
  }

  close(): void {
    this.sqlite.close();
  }
}

/** The database file inside `DATA_DIR` (the Fly volume in production). */
export const databaseFile = (dataDir: string): string => path.join(dataDir, 'boardgames.sqlite');
