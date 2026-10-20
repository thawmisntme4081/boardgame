import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { GameDefinition, Outcome } from '@platform/engine';
import {
  createGame,
  viewFor,
  YUL,
  type AckResult,
  type GameState,
  type JoinResult,
  type Seat,
} from '@sky/rules';
import { createRandomAgent } from '@sky/rules/random-play';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { restoreMatch, SNAPSHOT_EVERY } from './rooms';
import { SkyRooms as RoomManager, type SkyRoom as Room } from './test-server';
import {
  fromStored,
  hashToken,
  MemoryMatchStore,
  ROOM_FORMAT,
  SqliteMatchStore,
  toStored,
  type MatchRecord,
  type MatchStore,
} from './store';
import { move, nextView, startTestServer, takeOff, type Client } from './test-server';

const dirs: string[] = [];
const tempFile = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sky-store-'));
  dirs.push(dir);
  return path.join(dir, 'rooms.sqlite');
};

let servers: Awaited<ReturnType<typeof startTestServer>>[] = [];
const stores: MatchStore[] = [];
afterEach(async () => {
  // Close the stores first: Windows cannot delete an open database file.
  for (const server of servers) {
    server.rooms.close();
    await server.close();
  }
  servers = [];
  for (const store of stores.splice(0)) store.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const joined = (result: JoinResult) => {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result;
};
const expectOk = (result: AckResult) => expect(result).toEqual({ ok: true });

const CONFIG = { scenario: YUL.id, timer: false, roundTimerMs: 180_000, autoRollDelayMs: 5_000 };

const room = (code: string, patch: Partial<Room> = {}): Room => ({
  code,
  players: {
    pilot: {
      seat: 'pilot',
      name: 'Ana',
      tokenHash: hashToken('token-ana'),
      socketId: 'socket-1',
      creator: true,
      seq: 0,
    },
  },
  gameId: 'sky-team',
  config: CONFIG,
  match: { id: `${code}-1-a`, number: 1, version: 0 },
  game: createGame(YUL, 7, { setup: true }),
  creatorIp: '1.2.3.4',
  createdAt: 1,
  lastActivity: 2,
  ...patch,
});

const record = (id: string, patch: Partial<MatchRecord> = {}): MatchRecord => ({
  id,
  roomCode: 'ABCD',
  gameId: 'sky-team',
  rulesVersion: 1,
  config: CONFIG,
  seed: 7,
  status: 'open',
  createdAt: 1,
  endedAt: null,
  outcome: null,
  ...patch,
});

describe.each([
  ['memory', () => new MemoryMatchStore()],
  ['SQLite', () => new SqliteMatchStore(tempFile())],
] as [string, () => MatchStore][])('%s match store', (_name, makeStore) => {
  const open = () => {
    const store = makeStore();
    stores.push(store);
    return store;
  };

  it('saves, overwrites, loads and deletes rooms (without their game)', () => {
    const store = open();
    store.saveRoom(toStored(room('ABCD')));
    store.saveRoom(toStored(room('EFGH')));
    store.saveRoom(toStored(room('ABCD', { lastActivity: 99 })));
    const loaded = store.loadRooms().sort((a, b) => a.code.localeCompare(b.code));
    expect(loaded.map((r) => [r.code, r.lastActivity])).toEqual([
      ['ABCD', 99],
      ['EFGH', 2],
    ]);
    expect(loaded[0]).not.toHaveProperty('game');
    store.deleteRoom('ABCD');
    expect(store.loadRooms().map((r) => r.code)).toEqual(['EFGH']);
  });

  it('loads a match as its latest snapshot and the moves after it', () => {
    const store = open();
    store.createMatch(record('M1'), { n: 0, state: { s: 0 } });
    for (const n of [1, 2, 3]) store.appendMove('M1', { n, move: { m: n }, by: 'pilot', at: n });
    expect(store.loadMatch('M1')).toMatchObject({
      match: { id: 'M1', status: 'open', config: CONFIG },
      snapshot: { n: 0, state: { s: 0 } },
      moves: [1, 2, 3].map((n) => ({ n, by: 'pilot', at: n, move: { m: n } })),
    });
    store.saveSnapshot('M1', { n: 2, state: { s: 2 } });
    expect(store.loadMatch('M1')).toMatchObject({
      snapshot: { n: 2, state: { s: 2 } },
      moves: [{ n: 3, by: 'pilot', at: 3, move: { m: 3 } }],
    });
    expect(store.loadMatch('nope')).toBeUndefined();
  });

  it("deletes one game's abandoned matches older than the cutoff, with their log", () => {
    const store = open();
    store.createMatch(record('OTHER', { gameId: 'twilight-struggle' }), { n: 0, state: {} });
    store.endMatch('OTHER', 'abandoned', null, 100);
    for (const id of ['OLD', 'NEW', 'DONE']) {
      store.createMatch(record(id), { n: 0, state: {} });
      store.appendMove(id, { n: 1, move: {}, by: 'pilot', at: 1 });
    }
    store.endMatch('OLD', 'abandoned', null, 100);
    store.endMatch('NEW', 'abandoned', null, 300);
    store.endMatch('DONE', 'over', { kind: 'coop', won: true, reasons: [] }, 100);
    expect(store.pruneEnded('sky-team', 'abandoned', 200)).toBe(1);
    expect(store.loadMatch('OLD')).toBeUndefined();
    expect(store.loadMatch('NEW')).toBeDefined();
    expect(store.loadMatch('DONE')).toBeDefined();
    // Another game's abandoned match is not this game's to delete.
    expect(store.loadMatch('OTHER')).toBeDefined();
    expect(store.pruneEnded('sky-team', 'abandoned', 200)).toBe(0);
    // Finished matches go by their own rule.
    expect(store.pruneEnded('sky-team', 'over', 200)).toBe(1);
    expect(store.loadMatch('DONE')).toBeUndefined();
  });

  it('lists the open matches, and records how one ended', () => {
    const store = open();
    store.createMatch(record('M1'), { n: 0, state: {} });
    store.createMatch(record('M2'), { n: 0, state: {} });
    const outcome: Outcome = { kind: 'coop', won: true, reasons: [] };
    store.endMatch('M1', 'over', outcome, 50);
    expect(store.listOpen().map((m) => m.id)).toEqual(['M2']);
    expect(store.loadMatch('M1')!.match).toMatchObject({ status: 'over', endedAt: 50, outcome });
  });
});

describe('saved room format', () => {
  it('never saves the connection, the timer or the game, and loads every player offline', () => {
    const timer = setTimeout(() => {}, 0);
    const live = room('ABCD', { timer });
    const stored = toStored(live);
    clearTimeout(timer);
    expect(stored.players.pilot).not.toHaveProperty('socketId');
    expect(stored).not.toHaveProperty('timer');
    expect(stored).not.toHaveProperty('game');
    expect(fromStored(stored, live.game).players.pilot!.socketId).toBeNull();
  });

  it('drops room rows it cannot read', () => {
    const memory = new MemoryMatchStore();
    memory.saveRaw('OLDR', '{"old":true}', ROOM_FORMAT + 1);
    memory.saveRaw('OLD2', '{"old":true}', 1);
    memory.saveRoom(toStored(room('NEWR')));
    expect(memory.loadRooms().map((r) => r.code)).toEqual(['NEWR']);
  });
});

/** A room row as the server saved it before the match log (format 3: the game inside). */
function roomWithGame(code: string, token: string) {
  return JSON.stringify({
    code,
    gameId: 'sky-team',
    players: {
      pilot: { seat: 'pilot', name: 'Ana', token, socketId: null, creator: true, seq: 4 },
    },
    config: CONFIG,
    match: { id: `${code}-1`, number: 1, version: 6 },
    game: createGame(YUL, 11, { setup: true }),
    creatorIp: '1.2.3.4',
    createdAt: 1,
    lastActivity: Date.now(),
  });
}

describe('rooms saved before the match log (Sky Team 12, format 3)', () => {
  it('become a room and a match that starts from the saved game; the old token still works', () => {
    const file = tempFile();
    // The database as the live site has it: only the rooms table, schema version 0.
    const raw = new Database(file);
    raw.exec(
      'CREATE TABLE rooms (code TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL, version INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
    );
    const token = '0f8fad5b-d9cb-469f-a165-70867728950e';
    raw
      .prepare('INSERT INTO rooms (code, json, version, updated_at) VALUES (?, ?, ?, ?)')
      .run('OLDR', roomWithGame('OLDR', token), 3, Date.now());
    raw.close();

    const store = new SqliteMatchStore(file);
    stores.push(store);
    const rooms = new RoomManager({ store });
    const loaded = rooms.get('OLDR')!;
    expect(loaded.game).toEqual(createGame(YUL, 11, { setup: true }));
    expect(loaded.match).toMatchObject({ id: 'OLDR-1', version: 6 });
    expect(loaded.players.pilot).toMatchObject({ tokenHash: hashToken(token), seq: 4 });
    expect(rooms.rejoin('OLDR', token, 's1').ok).toBe(true);
    rooms.flush();

    const check = new Database(file);
    const rows = check.prepare('SELECT json, version FROM rooms').all() as {
      json: string;
      version: number;
    }[];
    check.close();
    expect(rows.map((r) => r.version)).toEqual([ROOM_FORMAT]);
    expect(rows[0]!.json).not.toContain(token);
  });
});

describe('room manager with a store', () => {
  it('loads saved rooms with everyone offline, and keeps per-IP limits', () => {
    const store = new MemoryMatchStore();
    const first = new RoomManager({ store, now: () => 1_000, maxRoomsPerIp: 2 });
    // The server saves a room with every change it broadcasts (here: by hand).
    for (const r of [first.create('Ana', 's1', '1.2.3.4'), first.create('Ben', 's2', '1.2.3.4')]) {
      if (r.ok) first.save(r.value.room);
    }
    first.close();
    const rooms = new RoomManager({ store, now: () => 1_000, maxRoomsPerIp: 2 });
    expect(rooms.size).toBe(2);
    for (const r of rooms.all()) expect(r.players.pilot!.socketId).toBeNull();
    // Both loaded rooms still count for their creator's address.
    expect(rooms.create('Cleo', 's3', '1.2.3.4')).toEqual({ ok: false, error: 'too-many-rooms' });
  });

  it('sweeps rooms idle too long when it starts, and abandons their matches', () => {
    const store = new MemoryMatchStore();
    let now = 0;
    const first = new RoomManager({ store, now: () => now, idleTtlMs: 30_000 });
    const old = first.create('Ana', 's1');
    now = 50_000;
    const recent = first.create('Ben', 's2');
    if (!old.ok || !recent.ok) throw new Error('create');
    first.save(old.value.room);
    first.save(recent.value.room);
    first.close();
    now = 60_000;
    const rooms = new RoomManager({ store, now: () => now, idleTtlMs: 30_000 });
    expect(rooms.all().map((r) => r.code)).toEqual([recent.value.room.code]);
    expect(store.loadRooms().map((r) => r.code)).toEqual([recent.value.room.code]);
    expect(store.listOpen().map((m) => m.id)).toEqual([recent.value.room.match.id]);
    expect(store.loadMatch(old.value.room.match.id)!.match.status).toBe('abandoned');
  });

  it('saves the room on the next tick, but logs each move at once, before anyone sees it', async () => {
    const store = new MemoryMatchStore();
    const rooms = new RoomManager({ store });
    const created = rooms.create('Ana', 's1');
    if (!created.ok) throw new Error('create');
    const { room: r } = created.value;
    const firstMatch = r.match.id;
    rooms.save(r);
    expect(store.loadRooms()).toEqual([]); // not on the reply path
    await new Promise((resolve) => setImmediate(resolve));
    expect(store.loadRooms().map((s) => s.code)).toEqual([r.code]);

    rooms.join(r.code, 'Ben', 's2');
    // The join is a table move: in the log straight away.
    expect(store.loadMatch(firstMatch)!.moves).toEqual([
      expect.objectContaining({
        n: 1,
        by: 'system',
        move: { type: 'table:join', seat: 'copilot' },
      }),
    ]);
    expect(store.seatsOf(firstMatch).map((s) => s.name)).toEqual(['Ana', 'Ben']);
    rooms.leave('s1');
    // Someone left: that match is abandoned and a new one starts for Ben.
    expect(store.loadMatch(firstMatch)!.match.status).toBe('abandoned');
    expect(store.listOpen().map((m) => m.id)).toEqual([r.match.id]);
    rooms.leave('s2');
    expect(store.loadRooms()).toEqual([]);
    expect(store.listOpen()).toEqual([]);
  });

  it('never keeps a rejoin token itself, only its hash', () => {
    const file = tempFile();
    const store = new SqliteMatchStore(file);
    const rooms = new RoomManager({ store });
    const created = rooms.create('Ana', 's1');
    if (!created.ok) throw new Error('create');
    rooms.join(created.value.room.code, 'Ben', 's2');
    rooms.flush();
    rooms.close();
    const raw = new Database(file);
    const dump = JSON.stringify([
      raw.prepare('SELECT * FROM rooms').all(),
      raw.prepare('SELECT * FROM match_seats').all(),
    ]);
    raw.close();
    expect(dump).not.toContain(created.value.token!);
    expect(dump).toContain(hashToken(created.value.token!));
  });
});

/** Plays a whole random game through the room manager, the way the server would. */
function playThrough(rooms: RoomManager, seed: number) {
  const created = rooms.create('Ana', 's1');
  if (!created.ok) throw new Error('create');
  const { room: r, player } = created.value;
  rooms.join(r.code, 'Ben', 's2');
  rooms.chooseSeat(r, player, 'pilot');
  rooms.move(r, 'pilot', { type: 'confirm' });
  rooms.move(r, 'copilot', { type: 'confirm' });
  const agent = createRandomAgent(seed);
  const { definition } = rooms.entry(r);
  for (let step = 0; step < 1000 && definition.outcome(r.game) === null; step++) {
    if (r.game.phase === 'strategy') {
      for (const seat of ['pilot', 'copilot'] as const) rooms.move(r, seat, { type: 'ready' });
      continue;
    }
    const action = agent(r.game);
    const result =
      action.type === 'place'
        ? rooms.move(r, action.seat, { type: 'place', ...action.intent })
        : action.type === 'reroll'
          ? rooms.move(r, action.seat, { type: 'reroll', dieIds: action.dieIds })
          : action.type === 'spend-reroll'
            ? rooms.move(r, action.seat, { type: 'spend-reroll' })
            : action.type === 'ability'
              ? rooms.move(r, action.seat, { type: 'ability', ...action.action })
              : undefined;
    if (!result?.ok) throw new Error(`step ${step}: ${JSON.stringify(action)} refused`);
  }
  return r;
}

/** Test access to everything a memory store holds for a match. */
const internals = (store: MemoryMatchStore) =>
  store as unknown as {
    snapshots: Map<string, { n: number; state: GameState }[]>;
    moves: Map<string, { n: number; move: unknown; by: string; at: number }[]>;
  };

describe('the match log', () => {
  it('replays every random game to exactly its live state, snapshots or not', () => {
    let longest = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const store = new MemoryMatchStore();
      const rooms = new RoomManager({ store, seed: () => seed });
      const live = playThrough(rooms, seed);
      longest = Math.max(longest, live.match.version);
      const loaded = store.loadMatch(live.match.id)!;
      expect(loaded.match).toMatchObject({ status: 'over', seed });
      const { definition } = rooms.entry(live);
      expect(restoreMatch(definition, loaded)).toEqual({
        state: live.game,
        version: live.match.version,
      });
      // From the very first snapshot (the state after setup), every move replayed.
      const fromStart = {
        ...loaded,
        snapshot: internals(store).snapshots.get(live.match.id)![0]!,
        moves: internals(store).moves.get(live.match.id)!,
      };
      expect(restoreMatch(definition, fromStart)!.state).toEqual(live.game);
    }
    // At least one game ran past a mid-game snapshot.
    expect(longest).toBeGreaterThan(SNAPSHOT_EVERY);
  });

  it('loads a match saved by older rules through migrate, or not at all', () => {
    type S = { count: number; label?: string };
    const toy: GameDefinition<S, { type: 'add' }, S, object> = {
      id: 'toy',
      version: 2,
      meta: { seats: ['a'], minPlayers: 1, maxPlayers: 1, mode: 'coop' },
      configSchema: z.object({}),
      moveSchema: z.object({ type: z.literal('add') }),
      setup: () => ({ count: 0 }),
      actors: () => [],
      validate: () => ({ ok: true }),
      apply: (s) => ({ ...s, count: s.count + 1 }),
      view: (s) => s,
      outcome: () => null,
    };
    const loaded = {
      match: record('T1', { gameId: 'toy', rulesVersion: 1 }),
      snapshot: { n: 3, state: { count: 3 } },
      moves: [{ n: 4, move: { type: 'add' }, by: 'a', at: 0 }],
    };
    expect(restoreMatch(toy, loaded)).toBeUndefined();
    const migrated = { ...toy, migrate: (s: unknown) => ({ ...(s as S), label: 'v2' }) };
    expect(restoreMatch(migrated, loaded)).toEqual({
      state: { count: 4, label: 'v2' },
      version: 4,
    });
  });
});

describe('a restart in the middle of a game', () => {
  /** A real server on a SQLite file; `restart` closes it and starts a new one on the same file. */
  async function serverOn(file: string, roundTimerMs?: number) {
    const rooms = new RoomManager({
      seed: () => 3,
      store: new SqliteMatchStore(file),
      ...(roundTimerMs && { settings: { 'sky-team': { roundTimerMs } } }),
    });
    const server = await startTestServer(rooms);
    servers.push(server);
    return server;
  }

  async function startGame(server: Awaited<ReturnType<typeof serverOn>>, timer = false) {
    const pilot = await server.connect();
    const copilot = await server.connect();
    const ana = joined(
      await pilot.emitWithAck('room:create', { name: 'Ana', game: 'sky-team', config: { timer } }),
    );
    const ben = joined(await copilot.emitWithAck('room:join', { code: ana.code, name: 'Ben' }));
    await takeOff(pilot, copilot);
    expectOk(await move(pilot, { type: 'ready' }));
    const rolled = nextView(pilot);
    expectOk(await move(copilot, { type: 'ready' }));
    await rolled;
    return {
      code: ana.code,
      tokens: { pilot: ana.token, copilot: ben.token },
      clients: { pilot, copilot },
    };
  }

  async function rejoin(server: Awaited<ReturnType<typeof serverOn>>, code: string, token: string) {
    const client: Client = await server.connect();
    const view = nextView(client);
    joined(await client.emitWithAck('room:rejoin', { code, token }));
    return view;
  }

  /** The current player places one die, so the game is mid-round. */
  async function placeOne(
    server: Awaited<ReturnType<typeof serverOn>>,
    code: string,
    clients: Record<Seat, Client>,
  ) {
    const game = server.rooms.get(code)!.game;
    const seat: Seat = game.currentSeat!;
    const die = game.dice[seat][0]!;
    const slot = seat === 'pilot' ? 'axisPilot' : 'axisCopilot';
    expectOk(await move(clients[seat], { type: 'place', dieId: die.id, slot, coffeeDelta: 0 }));
    await new Promise((resolve) => setImmediate(resolve));
  }

  it('continues with the same view for both players after the server restarts', async () => {
    const file = tempFile();
    const first = await serverOn(file);
    const { code, tokens, clients } = await startGame(first);
    await placeOne(first, code, clients);
    const before = first.rooms.get(code)!.game;
    first.rooms.close();
    await first.close();

    const second = await serverOn(file);
    expect(second.rooms.get(code)!.game).toEqual(before);
    for (const s of ['pilot', 'copilot'] as const) {
      expect(await rejoin(second, code, tokens[s])).toEqual(viewFor(before, s));
    }
    // And play goes on: the other player can place a die.
    const other: Seat = before.currentSeat!;
    const client = await second.connect();
    joined(await client.emitWithAck('room:rejoin', { code, token: tokens[other] }));
    const otherDie = before.dice[other][0]!;
    const otherSlot = other === 'pilot' ? 'axisPilot' : 'axisCopilot';
    expectOk(
      await move(client, { type: 'place', dieId: otherDie.id, slot: otherSlot, coffeeDelta: 0 }),
    );
  });

  it('rebuilds the game from the log when the server stopped without a last snapshot', async () => {
    const file = tempFile();
    const first = await serverOn(file);
    const { code, clients } = await startGame(first);
    await placeOne(first, code, clients);
    const before = first.rooms.get(code)!.game;
    // As if the process died: no shutdown, so no snapshot of the current state; only the log.
    first.rooms.flush();

    const store = new SqliteMatchStore(file);
    stores.push(store);
    expect(new RoomManager({ store }).get(code)!.game).toEqual(before);
  });

  it('ends a timed round whose time ran out while the server was down', async () => {
    const file = tempFile();
    const first = await serverOn(file, 300);
    const { code, tokens } = await startGame(first, true);
    expect(first.rooms.get(code)!.game.deadline).not.toBeNull();
    await new Promise((resolve) => setImmediate(resolve));
    first.rooms.close();
    await first.close();
    await new Promise((resolve) => setTimeout(resolve, 400)); // the deadline passes while down

    const second = await serverOn(file, 300);
    await new Promise((resolve) => setTimeout(resolve, 50)); // the re-armed timer fires at once
    expect(second.rooms.get(code)!.game).toMatchObject({ phase: 'lost', endReason: 'time-up' });
    expect(await rejoin(second, code, tokens.pilot)).toMatchObject({
      phase: 'lost',
      endReason: 'time-up',
    });
  });
});
