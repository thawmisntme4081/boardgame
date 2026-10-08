// Platform 06 E: each account's Flight Log, written by the server when a match ends.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRandomAgent } from '@sky/rules/random-play';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accounts } from './accounts';
import { mockGoogleSignIn } from './google-test';
import { RoomManager, type Room } from './rooms';
import { openDatabase, SqliteMatchStore } from './store';
import { startTestServer } from './test-server';

const SECRET = 'test-secret-that-is-long-enough-for-better-auth-0123456789';
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});
const tempFile = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sky-flight-'));
  dirs.push(dir);
  return path.join(dir, 'boardgames.sqlite');
};

/** Plays a random game to its end; `ana` and `ben` are account ids (or none for a guest). */
function playOut(rooms: RoomManager, ana?: string, ben?: string): Room {
  const created = rooms.create('Ana', 's1', 'ip', { ...(ana && { userId: ana }) });
  if (!created.ok) throw new Error('create');
  const { room, player } = created.value;
  rooms.join(room.code, 'Ben', 's2', ben);
  rooms.chooseSeat(room, player, 'pilot');
  rooms.move(room, 'pilot', { type: 'confirm' });
  rooms.move(room, 'copilot', { type: 'confirm' });
  const agent = createRandomAgent(5);
  const { definition } = rooms.entry(room);
  for (let step = 0; step < 1000 && definition.outcome(room.game) === null; step++) {
    if (room.game.phase === 'strategy') {
      for (const seat of ['pilot', 'copilot'] as const) rooms.move(room, seat, { type: 'ready' });
      continue;
    }
    const action = agent(room.game);
    if (action.type === 'place') rooms.move(room, action.seat, { type: 'place', ...action.intent });
    else if (action.type === 'reroll')
      rooms.move(room, action.seat, { type: 'reroll', dieIds: action.dieIds });
    else if (action.type === 'spend-reroll')
      rooms.move(room, action.seat, { type: 'spend-reroll' });
    else if (action.type === 'ability')
      rooms.move(room, action.seat, { type: 'ability', ...action.action });
  }
  expect(definition.outcome(room.game)).not.toBeNull();
  return room;
}

describe('the Flight Log per account', () => {
  it('writes one entry per signed-in player, once, also after a restart', () => {
    const file = tempFile();
    const first = new RoomManager({ store: new SqliteMatchStore(file), seed: () => 5 });
    const room = playOut(first, 'u-ana');
    expect(first.flightLog('u-ana', 'sky-team')).toHaveLength(1);
    expect(first.flightLog('u-ana', 'sky-team')[0]).toMatchObject({
      v: 1,
      partner: 'Ben',
      seat: 'pilot',
    });
    // A guest has no log; nobody else's entries show up.
    expect(first.flightLog('u-ben', 'sky-team')).toEqual([]);
    expect(first.flightLog('u-ana', 'other-game')).toEqual([]);
    first.save(room);
    first.close();

    // Restart: the room loads again, finished; its end is not written a second time.
    const second = new RoomManager({ store: new SqliteMatchStore(file), seed: () => 5 });
    expect(second.get(room.code)).toBeDefined();
    expect(second.flightLog('u-ana', 'sky-team')).toHaveLength(1);
    second.close();
  });

  it('writes both players of a match, each from their own seat', () => {
    const store = new SqliteMatchStore(openDatabase(':memory:'));
    const rooms = new RoomManager({ store, seed: () => 5 });
    playOut(rooms, 'u-ana', 'u-ben');
    expect(rooms.flightLog('u-ana', 'sky-team')[0]).toMatchObject({
      seat: 'pilot',
      partner: 'Ben',
    });
    expect(rooms.flightLog('u-ben', 'sky-team')[0]).toMatchObject({
      seat: 'copilot',
      partner: 'Ana',
    });
  });

  it('GET /api/flight-log gives an account its own entries and nobody else', async () => {
    const database = openDatabase(':memory:');
    const store = new SqliteMatchStore(database);
    const rooms = new RoomManager({ store, seed: () => 5 });
    const signInWithGoogle = mockGoogleSignIn();
    const server = await startTestServer(rooms, {
      sweepIntervalMs: 0,
      accounts: accounts({
        database,
        secret: SECRET,
        baseURL: 'http://localhost',
        google: { clientId: 'id', clientSecret: 'secret' },
      }),
    });
    try {
      const get = (cookie?: string) =>
        fetch(`${server.url}/api/flight-log?game=sky-team`, {
          ...(cookie && { headers: { cookie } }),
        });
      const ana = await signInWithGoogle(server.url, 'ana@example.com');
      const ben = await signInWithGoogle(server.url, 'ben@example.com');
      const anaId = (
        (await (await fetch(`${server.url}/auth/me`, { headers: { cookie: ana } })).json()) as {
          id: string;
        }
      ).id;
      playOut(rooms, anaId);

      const mine = await get(ana);
      expect(mine.status).toBe(200);
      expect(await mine.json()).toMatchObject([{ partner: 'Ben', seat: 'pilot' }]);
      expect(await (await get(ben)).json()).toEqual([]);
      expect((await get()).status).toBe(401);
    } finally {
      await server.close();
    }
  });

  it("imports a device's games once, skips invalid ones and does not add a game twice", () => {
    const store = new SqliteMatchStore(openDatabase(':memory:'));
    const rooms = new RoomManager({ store });
    const game = (at: number, over = {}) => ({
      v: 1,
      scenario: 'yul-green',
      seat: 'pilot',
      partner: 'Ben',
      abilities: [],
      result: 'won',
      reasons: [],
      rounds: 7,
      at,
      ...over,
    });
    const local = [game(100), game(200, { result: 'lost' }), { junk: true }];
    expect(rooms.importFlightLog('u-ana', 'sky-team', local)).toBe(2);
    // A second device with one of the same games, and a new one.
    rooms.importFlightLog('u-ana', 'sky-team', [game(100), game(300)]);
    expect(rooms.flightLog('u-ana', 'sky-team').map((r) => (r as { at: number }).at)).toEqual([
      300, 200, 100,
    ]);
    expect(rooms.flightLog('u-ben', 'sky-team')).toEqual([]);
    expect(rooms.importFlightLog('u-ana', 'nope', local)).toBeUndefined();
  });

  it('DELETE /api/account removes the account and its log; its seat stays as a guest', async () => {
    const database = openDatabase(':memory:');
    const store = new SqliteMatchStore(database);
    const rooms = new RoomManager({ store, seed: () => 5 });
    const signInWithGoogle = mockGoogleSignIn();
    const server = await startTestServer(rooms, {
      sweepIntervalMs: 0,
      accounts: accounts({
        database,
        secret: SECRET,
        baseURL: 'http://localhost',
        google: { clientId: 'id', clientSecret: 'secret' },
      }),
    });
    try {
      const cookie = await signInWithGoogle(server.url, 'ana@example.com');
      const me = (await (await fetch(`${server.url}/auth/me`, { headers: { cookie } })).json()) as {
        id: string;
      };
      const room = playOut(rooms, me.id);
      expect(rooms.flightLog(me.id, 'sky-team')).toHaveLength(1);

      const gone = await fetch(`${server.url}/api/account`, {
        method: 'DELETE',
        headers: { cookie },
      });
      expect(gone.status).toBe(200);
      expect(rooms.flightLog(me.id, 'sky-team')).toEqual([]);
      expect(room.players.pilot?.userId).toBeUndefined();
      expect(store.loadMatch(room.match.id)).toBeDefined();
      // Signed out everywhere: the old cookie is no account any more, and no user row is left.
      expect(
        await (await fetch(`${server.url}/auth/me`, { headers: { cookie } })).json(),
      ).toBeNull();
      const raw = database.prepare('SELECT count(*) AS n FROM users').get() as { n: number };
      expect(raw.n).toBe(0);
      expect(
        (await fetch(`${server.url}/api/account`, { method: 'DELETE', headers: { cookie } }))
          .status,
      ).toBe(401);
    } finally {
      await server.close();
    }
  });
});
