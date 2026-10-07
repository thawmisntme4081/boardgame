// Platform 06 D: seats follow the account. Real sockets, with the session cookie sent in the
// handshake the way a signed-in browser sends it.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { accounts } from './accounts';
import { RoomManager } from './rooms';
import { openDatabase, SqliteMatchStore } from './store';
import { next, startTestServer, type Client } from './test-server';

const SECRET = 'test-secret-that-is-long-enough-for-better-auth-0123456789';

type TestServer = Awaited<ReturnType<typeof startTestServer>>;
let servers: TestServer[] = [];
afterEach(async () => {
  for (const server of servers) await server.close();
  servers = [];
});

/** A server with accounts (email codes kept in `codes`), on `database`. */
async function start(database: Database.Database = openDatabase(':memory:'), rooms?: RoomManager) {
  const codes: string[] = [];
  const server = await startTestServer(rooms ?? new RoomManager(), {
    sweepIntervalMs: 0,
    accounts: accounts({
      database,
      secret: SECRET,
      baseURL: 'http://localhost',
      sendCode: (_email, code) => {
        codes.push(code);
        return Promise.resolve();
      },
    }),
  });
  servers.push(server);

  /** Signs `email` in with a code (an account is made on first use); the session cookie. */
  const signIn = async (email: string) => {
    const post = (route: string, body: unknown) =>
      fetch(`${server.url}${route}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify(body),
      });
    await post('/api/auth/email-otp/send-verification-otp', { email, type: 'sign-in' });
    const res = await post('/api/auth/sign-in/email-otp', { email, otp: codes.at(-1) });
    expect(res.status).toBe(200);
    return res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
  };
  return { server, signIn };
}

const create = (client: Client, name: string) =>
  client.emitWithAck('room:create', { name, game: 'sky-team' });

function joined<R extends { ok: boolean }>(result: R): Extract<R, { ok: true }> {
  expect(result).toMatchObject({ ok: true });
  return result as Extract<R, { ok: true }>;
}

describe('a seat follows the account', () => {
  it('two devices, one account: the phone takes the seat back without a token', async () => {
    const { server, signIn } = await start();
    const cookie = await signIn('ana@example.com');
    const laptop = await server.connect(cookie);
    const created = joined(await create(laptop, 'Ana'));
    const guest = await server.connect();
    joined(await guest.emitWithAck('room:join', { code: created.code, name: 'Ben' }));

    // The laptop closes; on the phone, signed in to the same account, the seat comes back.
    laptop.disconnect();
    const phone = await server.connect(cookie);
    const view = next(phone, 'match:view');
    const resumed = joined(await phone.emitWithAck('room:resume', {}));
    expect(resumed).toMatchObject({ code: created.code, seat: created.seat, game: 'sky-team' });
    expect(resumed.token).not.toBe(created.token);
    expect((await view).seat).toBe(created.seat);

    // The old token stopped working; the laptop, signed in too, resumes the same way.
    const again = await server.connect(cookie);
    expect(
      await again.emitWithAck('room:rejoin', { code: created.code, token: created.token }),
    ).toEqual({ ok: false, error: 'bad-token' });
    expect(joined(await again.emitWithAck('room:resume', {})).seat).toBe(created.seat);
  });

  it('moves the seat off a device that is still connected', async () => {
    const { server, signIn } = await start();
    const cookie = await signIn('ana@example.com');
    const laptop = await server.connect(cookie);
    const created = joined(await create(laptop, 'Ana'));
    const phone = await server.connect(cookie);
    joined(await phone.emitWithAck('room:resume', {}));
    // The laptop is no longer seated: its requests are refused.
    expect(await laptop.emitWithAck('room:choose-seat', { seat: 'copilot' })).toEqual({
      ok: false,
      error: 'not-in-room',
    });
    expect(server.rooms.get(created.code)?.players[created.seat]?.socketId).toBe(phone.id);
  });

  it('one account never holds both seats: its own code gives its seat back', async () => {
    const { server, signIn } = await start();
    const cookie = await signIn('ana@example.com');
    const laptop = await server.connect(cookie);
    const created = joined(await create(laptop, 'Ana'));

    const phone = await server.connect(cookie);
    const back = joined(await phone.emitWithAck('room:join', { code: created.code, name: 'Ana' }));
    expect(back.seat).toBe(created.seat);
    const room = server.rooms.get(created.code)!;
    expect(Object.values(room.players).filter(Boolean)).toHaveLength(1);

    // The other seat is still free for the partner.
    const guest = await server.connect();
    const ben = joined(await guest.emitWithAck('room:join', { code: created.code, name: 'Ben' }));
    expect(ben.seat).not.toBe(created.seat);
  });

  it('links a guest seat to the account once that player signs in on the same device', async () => {
    const { server, signIn } = await start();
    const guest = await server.connect();
    const created = joined(await create(guest, 'Chi'));
    expect(server.rooms.get(created.code)?.players[created.seat]?.userId).toBeUndefined();

    // Signing in reconnects the socket; its rejoin (with the token) links the seat.
    const cookie = await signIn('chi@example.com');
    guest.disconnect();
    const signedIn = await server.connect(cookie);
    joined(await signedIn.emitWithAck('room:rejoin', { code: created.code, token: created.token }));
    expect(server.rooms.get(created.code)?.players[created.seat]?.userId).toEqual(
      expect.any(String),
    );

    const phone = await server.connect(cookie);
    expect(joined(await phone.emitWithAck('room:resume', {})).code).toBe(created.code);
  });
});

describe('guests', () => {
  it('play next to a signed-in player exactly as before (tokens, no resume)', async () => {
    const { server, signIn } = await start();
    const ana = await server.connect(await signIn('ana@example.com'));
    const created = joined(await create(ana, 'Ana'));
    const ben = await server.connect();
    const benSeat = joined(await ben.emitWithAck('room:join', { code: created.code, name: 'Ben' }));
    expect(server.rooms.get(created.code)?.players[benSeat.seat]?.userId).toBeUndefined();

    ben.disconnect();
    const benAgain = await server.connect();
    expect(await benAgain.emitWithAck('room:resume', {})).toEqual({
      ok: false,
      error: 'not-in-room',
    });
    const rejoined = joined(
      await benAgain.emitWithAck('room:rejoin', { code: created.code, token: benSeat.token }),
    );
    expect(rejoined).toMatchObject({ seat: benSeat.seat, token: benSeat.token });
  });

  it('a signed-in player without a seat has nothing to resume', async () => {
    const { server, signIn } = await start();
    const dao = await server.connect(await signIn('dao@example.com'));
    expect(await dao.emitWithAck('room:resume', {})).toEqual({ ok: false, error: 'not-in-room' });
  });
});

describe('saved', () => {
  it('keeps the account on the seat (match_seats and the room) across a restart', async () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'seats-')), 'boardgames.sqlite');
    const database = openDatabase(file);
    const first = await start(database, new RoomManager({ store: new SqliteMatchStore(database) }));
    const cookie = await first.signIn('ana@example.com');
    const laptop = await first.server.connect(cookie);
    const created = joined(await create(laptop, 'Ana'));
    const userId = first.server.rooms.get(created.code)!.players[created.seat]!.userId;
    expect(
      database
        .prepare('SELECT seat, user_id FROM match_seats WHERE match_id = ?')
        .all(created.matchId),
    ).toEqual([{ seat: created.seat, user_id: userId }]);
    first.server.rooms.flush();
    await first.server.close();
    servers = [];

    // A new server on the same database: the session and the seat are still there.
    const second = await start(
      database,
      new RoomManager({ store: new SqliteMatchStore(database) }),
    );
    const phone = await second.server.connect(cookie);
    expect(joined(await phone.emitWithAck('room:resume', {}))).toMatchObject({
      code: created.code,
      seat: created.seat,
    });
  });
});
