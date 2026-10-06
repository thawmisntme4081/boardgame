import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createGame, viewFor, YUL, type AckResult, type JoinResult, type Seat } from '@sky/shared';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { RoomManager, type Room } from './rooms';
import {
  fromStored,
  MemoryRoomStore,
  ROOM_FORMAT,
  SqliteRoomStore,
  toStored,
  type RoomStore,
  type StoredRoom,
} from './store';
import { next, startTestServer, takeOff, type Client } from './test-server';

const dirs: string[] = [];
const tempFile = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sky-store-'));
  dirs.push(dir);
  return path.join(dir, 'rooms.sqlite');
};

let servers: Awaited<ReturnType<typeof startTestServer>>[] = [];
afterEach(async () => {
  // Close the stores first: Windows cannot delete an open database file.
  for (const server of servers) {
    server.rooms.close();
    await server.close();
  }
  servers = [];
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const joined = (result: JoinResult) => {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result;
};
const expectOk = (result: AckResult) => expect(result).toEqual({ ok: true });

const room = (code: string, patch: Partial<Room> = {}): Room => ({
  code,
  players: {
    pilot: {
      seat: 'pilot',
      name: 'Ana',
      token: 'token-ana',
      socketId: 'socket-1',
      creator: true,
    },
  },
  config: { scenario: YUL.id, timerMs: null, autoRollDelayMs: 5_000 },
  game: createGame(YUL, 7, { setup: true }),
  creatorIp: '1.2.3.4',
  createdAt: 1,
  lastActivity: 2,
  ...patch,
});

describe.each([
  ['memory', () => new MemoryRoomStore()],
  ['SQLite', () => new SqliteRoomStore(tempFile())],
] as [string, () => RoomStore][])('%s room store', (_name, makeStore) => {
  it('saves, overwrites, loads and deletes rooms', () => {
    const store = makeStore();
    store.save(toStored(room('ABCD')));
    store.save(toStored(room('EFGH')));
    store.save(toStored(room('ABCD', { lastActivity: 99 })));
    const loaded = store.loadAll().sort((a, b) => a.code.localeCompare(b.code));
    expect(loaded.map((r) => [r.code, r.lastActivity])).toEqual([
      ['ABCD', 99],
      ['EFGH', 2],
    ]);
    expect(loaded[0]!.game).toEqual(room('ABCD').game);
    store.delete('ABCD');
    expect(store.loadAll().map((r) => r.code)).toEqual(['EFGH']);
    store.close();
  });
});

describe('saved room format', () => {
  it('never saves the connection or the timer, and loads every player offline', () => {
    const timer = setTimeout(() => {}, 0);
    const stored = toStored(room('ABCD', { timer }));
    clearTimeout(timer);
    expect(stored.players.pilot).not.toHaveProperty('socketId');
    expect(stored).not.toHaveProperty('timer');
    expect(fromStored(stored).players.pilot!.socketId).toBeNull();
  });

  it('drops rooms saved in another format instead of loading them wrongly', () => {
    const memory = new MemoryRoomStore();
    memory.saveRaw('OLDR', '{"old":true}', ROOM_FORMAT + 1);
    memory.save(toStored(room('NEWR')));
    expect(memory.loadAll().map((r) => r.code)).toEqual(['NEWR']);

    const file = tempFile();
    new SqliteRoomStore(file).close(); // creates the table
    const raw = new Database(file);
    raw
      .prepare('INSERT INTO rooms (code, json, version, updated_at) VALUES (?, ?, ?, ?)')
      .run('OLDR', '{"old":true}', ROOM_FORMAT - 1, 0);
    raw.close();
    const store = new SqliteRoomStore(file);
    expect(store.loadAll()).toEqual([]);
    store.close();
    const check = new Database(file);
    expect(check.prepare('SELECT COUNT(*) AS n FROM rooms').get()).toEqual({ n: 0 });
    check.close();
  });
});

describe('room manager with a store', () => {
  it('loads saved rooms with everyone offline, and keeps per-IP limits', () => {
    const store = new MemoryRoomStore();
    for (const code of ['AAAA', 'BBBB']) store.save(toStored(room(code, { lastActivity: 1_000 })));
    const rooms = new RoomManager({ store, now: () => 1_000, maxRoomsPerIp: 2 });
    expect(rooms.size).toBe(2);
    expect(rooms.get('AAAA')!.players.pilot!.socketId).toBeNull();
    // Both loaded rooms still count for their creator's address.
    expect(rooms.create('Cleo', 'socket-x', '1.2.3.4')).toEqual({
      ok: false,
      error: 'too-many-rooms',
    });
  });

  it('sweeps rooms idle too long when it starts (the server may have been stopped for days)', () => {
    const store = new MemoryRoomStore();
    store.save(toStored(room('OLDR', { lastActivity: 0 })));
    store.save(toStored(room('NEWR', { lastActivity: 50_000 })));
    const rooms = new RoomManager({ store, now: () => 60_000, idleTtlMs: 30_000 });
    expect(rooms.all().map((r) => r.code)).toEqual(['NEWR']);
    expect(store.loadAll().map((r) => r.code)).toEqual(['NEWR']);
  });

  it('saves on the next tick, once per room, and removes closed rooms from the store', async () => {
    const saved: string[] = [];
    const store: RoomStore = {
      loadAll: () => [],
      save: (r: StoredRoom) => void saved.push(r.code),
      delete: (code) => void saved.push(`-${code}`),
      close: () => {},
    };
    const rooms = new RoomManager({ store });
    const created = rooms.create('Ana', 'socket-1');
    if (!created.ok) throw new Error('create');
    const { room: r } = created.value;
    rooms.save(r);
    rooms.save(r);
    expect(saved).toEqual([]); // not on the reply path
    await new Promise((resolve) => setImmediate(resolve));
    expect(saved).toEqual([r.code]);
    rooms.leave('socket-1');
    expect(saved).toEqual([r.code, `-${r.code}`]);
  });
});

describe('a restart in the middle of a game', () => {
  /** A real server on a SQLite file; `restart` closes it and starts a new one on the same file. */
  async function serverOn(file: string, roundTimerMs?: number) {
    const rooms = new RoomManager({ seed: () => 3, store: new SqliteRoomStore(file) });
    const server = await startTestServer(rooms, { ...(roundTimerMs && { roundTimerMs }) });
    servers.push(server);
    return server;
  }

  async function startGame(server: Awaited<ReturnType<typeof serverOn>>, timer = false) {
    const pilot = await server.connect();
    const copilot = await server.connect();
    const ana = joined(await pilot.emitWithAck('room:create', { name: 'Ana', timer }));
    const ben = joined(await copilot.emitWithAck('room:join', { code: ana.code, name: 'Ben' }));
    await takeOff(pilot, copilot);
    expectOk(await pilot.emitWithAck('game:ready', {}));
    const rolled = next(pilot, 'game:view');
    expectOk(await copilot.emitWithAck('game:ready', {}));
    await rolled;
    return {
      code: ana.code,
      tokens: { pilot: ana.token, copilot: ben.token },
      clients: { pilot, copilot },
    };
  }

  async function rejoin(server: Awaited<ReturnType<typeof serverOn>>, code: string, token: string) {
    const client: Client = await server.connect();
    const view = next(client, 'game:view');
    joined(await client.emitWithAck('room:rejoin', { code, token }));
    return view;
  }

  it('continues with the same view for both players after the server restarts', async () => {
    const file = tempFile();
    const first = await serverOn(file);
    const { code, tokens, clients } = await startGame(first);
    // The first player places a die, so the saved game is mid-round.
    const game = first.rooms.get(code)!.game;
    const seat: Seat = game.currentSeat!;
    const die = game.dice[seat][0]!;
    const slot = seat === 'pilot' ? 'axisPilot' : 'axisCopilot';
    expectOk(
      await clients[seat].emitWithAck('game:place', { dieId: die.id, slot, coffeeDelta: 0 }),
    );
    await new Promise((resolve) => setImmediate(resolve));
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
      await client.emitWithAck('game:place', {
        dieId: otherDie.id,
        slot: otherSlot,
        coffeeDelta: 0,
      }),
    );
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
