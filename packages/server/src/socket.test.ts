import type { JoinResult, PlayerView } from '@sky/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { next, startTestServer, type Client } from './test-server';

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
  const created = joined(await pilot.emitWithAck('room:create', { name: 'Ana' }));
  const pilotView = next(pilot, 'game:view');
  const copilotView = next(copilot, 'game:view');
  const join = joined(await copilot.emitWithAck('room:join', { code: created.code, name: 'Ben' }));
  return { pilot, copilot, created, join, views: await Promise.all([pilotView, copilotView]) };
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
    const view = next(pilot, 'game:view');
    const presence = next(pilot, 'room:presence');
    const result = joined(await pilot.emitWithAck('room:create', { name: 'Ana' }));

    expect(result.code).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(result.seat).toBe('pilot');
    expect(result.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(await view).toMatchObject({ seat: 'pilot', phase: 'strategy', round: 1 });
    expect(await presence).toEqual({
      pilot: { name: 'Ana', online: true, ready: false },
      copilot: null,
    });
  });

  it('rejects a malformed payload without crashing', async () => {
    const socket = await server.connect();
    expect(await socket.emitWithAck('room:create', { name: '' })).toEqual({
      ok: false,
      error: 'bad-request',
    });
    expect(await socket.emitWithAck('room:create', 'hello' as never)).toEqual({
      ok: false,
      error: 'bad-request',
    });
    // No ack function at all: the server must survive and keep answering.
    (socket.emit as (event: string, payload: unknown) => void)('room:create', { name: 'Ana' });
    expect(await socket.emitWithAck('room:create', { name: 'Ana' })).toEqual({
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
    expect(copilotView).toMatchObject({ phase: 'strategy', myDice: [], partnerDiceLeft: 0 });
  });

  it('tells both players who is seated', async () => {
    const pilot = await server.connect();
    const copilot = await server.connect();
    const { code } = joined(await pilot.emitWithAck('room:create', { name: 'Ana' }));
    const presence = next(pilot, 'room:presence');
    await copilot.emitWithAck('room:join', { code, name: 'Ben' });
    expect(await presence).toEqual({
      pilot: { name: 'Ana', online: true, ready: false },
      copilot: { name: 'Ben', online: true, ready: false },
    });
  });

  it('accepts a lowercase code', async () => {
    const pilot = await server.connect();
    const copilot = await server.connect();
    const { code } = joined(await pilot.emitWithAck('room:create', { name: 'Ana' }));
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

describe('game:ready', () => {
  it('rolls once both players are ready and hides the partner dice', async () => {
    const { pilot, copilot } = await twoPlayers();

    const presence = next(copilot, 'room:presence');
    expect(await pilot.emitWithAck('game:ready', {})).toEqual({ ok: true });
    expect((await presence).pilot?.ready).toBe(true);

    const pilotView = next(pilot, 'game:view');
    const copilotView = next(copilot, 'game:view');
    expect(await copilot.emitWithAck('game:ready', {})).toEqual({ ok: true });
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
    await pilot.emitWithAck('game:ready', {});
    const presence = next(pilot, 'room:presence');
    await copilot.emitWithAck('game:ready', {});
    expect(await presence).toMatchObject({
      pilot: { ready: false },
      copilot: { ready: false },
    });
    expect(await pilot.emitWithAck('game:ready', {})).toEqual({ ok: false, error: 'not-strategy' });
  });

  it('waits for the partner to join before rolling', async () => {
    const pilot = await server.connect();
    const copilot = await server.connect();
    const { code } = joined(await pilot.emitWithAck('room:create', { name: 'Ana' }));
    await pilot.emitWithAck('game:ready', {});
    await copilot.emitWithAck('room:join', { code, name: 'Ben' });
    const view = next(copilot, 'game:view');
    await copilot.emitWithAck('game:ready', {});
    expect((await view).phase).toBe('placing');
  });

  it('needs a seat', async () => {
    const socket = await server.connect();
    expect(await socket.emitWithAck('game:ready', {})).toEqual({ ok: false, error: 'not-in-room' });
  });
});

describe('room:rejoin', () => {
  it('shows the partner offline, then restores the seat on a new connection', async () => {
    const { pilot, copilot, created } = await twoPlayers();
    await pilot.emitWithAck('game:ready', {});
    await copilot.emitWithAck('game:ready', {});

    const offline = next(copilot, 'room:presence');
    pilot.disconnect();
    expect((await offline).pilot).toMatchObject({ name: 'Ana', online: false });

    const returning: Client = await server.connect();
    const view = next(returning, 'game:view');
    const online = next(copilot, 'room:presence');
    const result = await returning.emitWithAck('room:rejoin', {
      code: created.code,
      token: created.token,
    });
    expect(result).toEqual(created);
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
