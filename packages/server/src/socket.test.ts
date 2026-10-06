import type { JoinResult, PlayerView } from '@sky/rules';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { move, next, nextView, startTestServer, takeOff, type Client } from './test-server';

const expectOk = (result: unknown) => expect(result).toEqual({ ok: true });

let server: Awaited<ReturnType<typeof startTestServer>>;

beforeEach(async () => {
  server = await startTestServer();
});

afterEach(async () => {
  await server.close();
});

function joined(result: JoinResult) {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result;
}

/** Pilot creates a room, co-pilot joins; resolves once both have their first views. */
async function twoPlayers() {
  const pilot = await server.connect();
  const copilot = await server.connect();
  const created = joined(await pilot.emitWithAck('room:create', { name: 'Ana', game: 'sky-team' }));
  const pilotView = nextView(pilot);
  const copilotView = nextView(copilot);
  const join = joined(await copilot.emitWithAck('room:join', { code: created.code, name: 'Ben' }));
  const views = await Promise.all([pilotView, copilotView]);
  // Round 1 starts once the creator has chosen the seats and both have confirmed.
  await takeOff(pilot, copilot);
  return { pilot, copilot, created, join, views };
}

describe('http', () => {
  it('serves /health', async () => {
    const res = await fetch(`${server.url}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, rooms: 0 });
  });
});

describe('room:create', () => {
  it('returns a code, the pilot seat and a token, then a view and presence', async () => {
    const pilot = await server.connect();
    const view = nextView(pilot);
    const presence = next(pilot, 'room:presence');
    const result = joined(
      await pilot.emitWithAck('room:create', { name: 'Ana', game: 'sky-team' }),
    );

    expect(result.code).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(result.seat).toBe('pilot');
    expect(result.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(await view).toMatchObject({ seat: 'pilot', phase: 'setup', round: 1 });
    expect(await presence).toMatchObject({
      pilot: { name: 'Ana', online: true, creator: true },
      copilot: null,
    });
  });

  it('rejects a malformed payload without crashing', async () => {
    const socket = await server.connect();
    expect(await socket.emitWithAck('room:create', { name: '', game: 'sky-team' })).toEqual({
      ok: false,
      error: 'bad-request',
    });
    expect(await socket.emitWithAck('room:create', 'hello' as never)).toEqual({
      ok: false,
      error: 'bad-request',
    });
    // No ack function at all: the server must survive and keep answering.
    (socket.emit as (event: string, payload: unknown) => void)('room:create', {
      name: 'Ana',
      game: 'sky-team',
    });
    expect(await socket.emitWithAck('room:create', { name: 'Ana', game: 'sky-team' })).toEqual({
      ok: false,
      error: 'already-in-room',
    });
  });
});

describe('room:join', () => {
  it('seats two clients in the same room and both receive a game:view', async () => {
    const { created, join, views } = await twoPlayers();
    expect(join).toMatchObject({ code: created.code, seat: 'copilot' });
    expect(join.token).not.toBe(created.token);
    const [pilotView, copilotView] = views;
    expect(pilotView.seat).toBe('pilot');
    expect(copilotView.seat).toBe('copilot');
    expect(copilotView).toMatchObject({ phase: 'setup', myDice: [], partnerDiceLeft: 0 });
  });

  it('tells both players who is seated', async () => {
    const pilot = await server.connect();
    const copilot = await server.connect();
    const { code } = joined(
      await pilot.emitWithAck('room:create', { name: 'Ana', game: 'sky-team' }),
    );
    const presence = next(pilot, 'room:presence');
    await copilot.emitWithAck('room:join', { code, name: 'Ben' });
    expect(await presence).toMatchObject({
      pilot: { name: 'Ana', online: true, creator: true },
      copilot: { name: 'Ben', online: true, creator: false },
    });
  });

  it('accepts a lowercase code', async () => {
    const pilot = await server.connect();
    const copilot = await server.connect();
    const { code } = joined(
      await pilot.emitWithAck('room:create', { name: 'Ana', game: 'sky-team' }),
    );
    const result = await copilot.emitWithAck('room:join', {
      code: code.toLowerCase(),
      name: 'Ben',
    });
    expect(result).toMatchObject({ ok: true, code, seat: 'copilot' });
  });

  it('reports unknown rooms, full rooms and bad payloads', async () => {
    const { created } = await twoPlayers();
    const third = await server.connect();
    expect(await third.emitWithAck('room:join', { code: 'QQQQ', name: 'Cat' })).toEqual({
      ok: false,
      error: 'room-not-found',
    });
    expect(await third.emitWithAck('room:join', { code: created.code, name: 'Cat' })).toEqual({
      ok: false,
      error: 'room-full',
    });
    expect(await third.emitWithAck('room:join', { code: 'AB1', name: 'Cat' })).toEqual({
      ok: false,
      error: 'bad-request',
    });
  });
});

describe('match:move: ready', () => {
  it('rolls once both players are ready and hides the partner dice', async () => {
    const { pilot, copilot } = await twoPlayers();

    const view = nextView(copilot);
    expect(await move(pilot, { type: 'ready' })).toEqual({ ok: true });
    expect((await view).crew.ready.pilot).toBe(true);

    const pilotView = nextView(pilot);
    const copilotView = nextView(copilot);
    expect(await move(copilot, { type: 'ready' })).toEqual({ ok: true });
    const views: PlayerView[] = await Promise.all([pilotView, copilotView]);

    for (const view of views) {
      expect(view).toMatchObject({ phase: 'placing', currentSeat: 'pilot', partnerDiceLeft: 4 });
      expect(view.myDice).toHaveLength(4);
    }
    const [p, c] = views;
    const pilotJson = JSON.stringify(p);
    for (const die of c!.myDice) expect(pilotJson).not.toContain(die.id);
    expect(JSON.stringify(c)).not.toContain(p!.myDice[0]!.id);
    for (const json of [pilotJson, JSON.stringify(c)]) {
      expect(json).not.toMatch(/rngSeed|rngState|"log"/);
    }
  });

  it('resets readiness after the roll and refuses ready while placing', async () => {
    const { pilot, copilot } = await twoPlayers();
    await move(pilot, { type: 'ready' });
    const view = nextView(pilot);
    await move(copilot, { type: 'ready' });
    expect((await view).crew.ready).toEqual({ pilot: false, copilot: false });
    expect(await move(pilot, { type: 'ready' })).toEqual({ ok: false, error: 'not-strategy' });
  });

  it('waits for the partner and both confirms before round 1 starts', async () => {
    const pilot = await server.connect();
    const copilot = await server.connect();
    const { code } = joined(
      await pilot.emitWithAck('room:create', { name: 'Ana', game: 'sky-team' }),
    );
    expect(await move(pilot, { type: 'confirm' })).toEqual({ ok: false, error: 'no-partner' });
    expect(await move(pilot, { type: 'ready' })).toEqual({ ok: false, error: 'not-strategy' });
    await copilot.emitWithAck('room:join', { code, name: 'Ben' });
    expect(await copilot.emitWithAck('room:choose-seat', { seat: 'pilot' })).toEqual({
      ok: false,
      error: 'not-creator',
    });
    expect(await move(pilot, { type: 'confirm' })).toEqual({
      ok: false,
      error: 'roles-missing',
    });
    expectOk(await pilot.emitWithAck('room:choose-seat', { seat: 'pilot' }));
    expectOk(await move(pilot, { type: 'confirm' }));
    const started = new Promise<PlayerView>((resolve) =>
      copilot.on('match:view', ({ view: v }) => v.phase === 'strategy' && resolve(v)),
    );
    expectOk(await move(copilot, { type: 'confirm' }));
    expect((await started).round).toBe(1);
  });

  it('needs a seat', async () => {
    const socket = await server.connect();
    expect(await move(socket, { type: 'ready' })).toEqual({ ok: false, error: 'not-in-room' });
  });
});

describe('room:rejoin', () => {
  it('shows the partner offline, then restores the seat on a new connection', async () => {
    const { pilot, copilot, created } = await twoPlayers();
    await move(pilot, { type: 'ready' });
    await move(copilot, { type: 'ready' });

    const offline = next(copilot, 'room:presence');
    pilot.disconnect();
    expect((await offline).pilot).toMatchObject({ name: 'Ana', online: false });

    const returning: Client = await server.connect();
    const view = nextView(returning);
    const online = next(copilot, 'room:presence');
    const result = await returning.emitWithAck('room:rejoin', {
      code: created.code,
      token: created.token,
    });
    // The same seat and match; `seq` is the last move counter the server took from this seat
    // ("ready" above), so the returning client carries on from there.
    if (!result.ok || !created.ok) throw new Error('expected both joins to succeed');
    expect(result).toEqual({ ...created, seq: result.seq });
    expect(result.seq).toBeGreaterThan(created.seq);
    expect(await view).toMatchObject({ seat: 'pilot', phase: 'placing' });
    expect((await view).myDice).toHaveLength(4);
    expect((await online).pilot).toMatchObject({ online: true });
  });

  it('rejects a wrong token or code', async () => {
    const { created } = await twoPlayers();
    const stranger = await server.connect();
    expect(
      await stranger.emitWithAck('room:rejoin', {
        code: created.code,
        token: '0f8fad5b-d9cb-469f-a165-70867728950e',
      }),
    ).toEqual({ ok: false, error: 'bad-token' });
    expect(
      await stranger.emitWithAck('room:rejoin', { code: 'QQQQ', token: created.token }),
    ).toEqual({ ok: false, error: 'room-not-found' });
    expect(
      await stranger.emitWithAck('room:rejoin', { code: created.code, token: 'nope' }),
    ).toEqual({ ok: false, error: 'bad-request' });
  });
});

describe('the match envelope', () => {
  /** Every envelope a client receives, in order. */
  function envelopes(client: Client) {
    const seen: { matchId: string; version: number; view: PlayerView }[] = [];
    client.on('match:view', (envelope) => seen.push(envelope));
    return seen;
  }

  it('numbers each change of a match, so views only move forward', async () => {
    const { pilot, copilot, created } = await twoPlayers();
    const seen = envelopes(pilot);
    await move(pilot, { type: 'ready' });
    await move(copilot, { type: 'ready' });
    await new Promise((r) => setTimeout(r, 50));
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(new Set(seen.map((e) => e.matchId))).toEqual(new Set([created.matchId]));
    const versions = seen.map((e) => e.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(versions.at(-1)!).toBeGreaterThan(versions[0]!);
  });

  it('refuses a move for another match, and a game the server does not host', async () => {
    const { pilot } = await twoPlayers();
    expect(
      await pilot.emitWithAck('match:move', {
        matchId: 'ZZZZ-1',
        seq: 999_999,
        move: { type: 'ready' },
      }),
    ).toEqual({ ok: false, error: 'stale-match' });
    const other = await server.connect();
    expect(await other.emitWithAck('room:create', { name: 'Cat', game: 'chess' })).toEqual({
      ok: false,
      error: 'unknown-game',
    });
    expect(
      await other.emitWithAck('room:create', {
        name: 'Cat',
        game: 'sky-team',
        config: { scenario: 'nowhere' },
      }),
    ).toEqual({ ok: false, error: 'bad-request' });
  });

  it('refuses a move the game does not know', async () => {
    const { pilot, created } = await twoPlayers();
    expect(
      await pilot.emitWithAck('match:move', {
        matchId: created.matchId,
        seq: 999_998,
        move: { type: 'teleport' } as never,
      }),
    ).toEqual({ ok: false, error: 'bad-request' });
  });
});
