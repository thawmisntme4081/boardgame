// Pandemic through the socket gateway: three players in one room, as the clients drive it.
import type { JoinResult, Presence } from '@platform/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import { RoomManager } from './rooms';
import { startTestServer, type Client } from './test-server';

type Server = Awaited<ReturnType<typeof startTestServer>>;
let server: Server | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

/** An event whose payload this test reads loosely (the shared helpers are typed for Sky Team). */
const send = <T>(client: Client, event: string, payload: unknown) =>
  (client as unknown as { emitWithAck(e: string, p: unknown): Promise<T> }).emitWithAck(
    event,
    payload,
  );

type Loose = Record<string, unknown>;

/** The first view this client receives that satisfies `ok` (earlier broadcasts may still arrive). */
const viewWhere = (client: Client, ok: (view: Loose) => boolean) =>
  new Promise<Loose>((resolve) => {
    const onView = ({ view }: { view: unknown }) => {
      if (!ok(view as Loose)) return;
      client.off('match:view', onView as never);
      resolve(view as Loose);
    };
    client.on('match:view', onView as never);
  });

/** The first presence this client receives that satisfies `ok`. */
const presenceWhere = (client: Client, ok: (presence: Presence) => boolean) =>
  new Promise<Presence>((resolve) => {
    const onPresence = (payload: unknown) => {
      if (!ok(payload as Presence)) return;
      client.off('room:presence', onPresence as never);
      resolve(payload as Presence);
    };
    client.on('room:presence', onPresence as never);
  });

describe('Pandemic over sockets', () => {
  it('seats 3 players, deals when the third sits down and refuses a fourth', async () => {
    server = await startTestServer(new RoomManager({ seed: () => 5 }));
    const [ana, ben, cy, late] = await Promise.all([1, 2, 3, 4].map(() => server!.connect()));

    const created = await send<JoinResult>(ana!, 'room:create', {
      name: 'Ana',
      game: 'pandemic',
      config: { players: 3 },
    });
    if (!created.ok) throw new Error('create failed');
    expect(created).toMatchObject({ game: 'pandemic', seat: 'p1' });

    // The creator waits; the view says who is seated, and the seed is not in it.
    const waitingTwo = viewWhere(
      ana!,
      (v) => v.status === 'waiting' && (v.seated as string[]).length === 2,
    );
    const benJoined = await send<JoinResult>(ben!, 'room:join', {
      code: created.code,
      name: 'Ben',
    });
    expect(benJoined).toMatchObject({ ok: true, seat: 'p2' });
    expect(await waitingTwo).toMatchObject({ status: 'waiting', seated: ['p1', 'p2'], players: 3 });

    const anaDealt = viewWhere(ana!, (v) => v.status === 'playing');
    const benDealt = viewWhere(ben!, (v) => v.status === 'playing');
    const cyJoined = await send<JoinResult>(cy!, 'room:join', { code: created.code, name: 'Cy' });
    expect(cyJoined).toMatchObject({ ok: true, seat: 'p3' });
    const dealt = await anaDealt;
    expect(dealt).toMatchObject({ status: 'playing', you: 'p1' });
    expect((await benDealt).you).toBe('p2');
    expect(JSON.stringify(dealt)).not.toMatch(/rngSeed|rngState|"playerDeck"|"infectionDeck"/);

    // The room is full for this game, although a fourth Pandemic seat exists.
    expect(await send(late!, 'room:join', { code: created.code, name: 'Late' })).toEqual({
      ok: false,
      error: 'room-full',
    });
  });

  it('shows the seats taken by name, and a seat left empty to whoever joins next', async () => {
    server = await startTestServer(new RoomManager({ seed: () => 5 }));
    const [ana, ben, cy, dee] = await Promise.all([1, 2, 3, 4].map(() => server!.connect()));
    const created = await send<JoinResult>(ana!, 'room:create', {
      name: 'Ana',
      game: 'pandemic',
      config: { players: 3 },
    });
    if (!created.ok) throw new Error('create failed');
    await send(ben!, 'room:join', { code: created.code, name: 'Ben' });
    await send(cy!, 'room:join', { code: created.code, name: 'Cy' });

    const gone = presenceWhere(ana!, (p) => p.p2 === null);
    expect(await send(ben!, 'room:leave', {})).toEqual({ ok: true });
    const afterLeave = await gone;
    expect(afterLeave.p1).toMatchObject({ name: 'Ana', creator: true });
    expect(afterLeave.p2).toBeNull();
    expect(afterLeave.p3).toMatchObject({ name: 'Cy' });
    expect(afterLeave.p4).toBeUndefined(); // a 3-player game has no 4th seat

    const taken = viewWhere(ana!, (v) => v.status === 'playing' && v.you === 'p1');
    const newcomer = await send<JoinResult>(dee!, 'room:join', { code: created.code, name: 'Dee' });
    expect(newcomer).toMatchObject({ ok: true, seat: 'p2' });
    expect(await taken).toMatchObject({ status: 'playing', you: 'p1' });
  });

  it('refuses a seat choice, and moves only from a dealt game', async () => {
    server = await startTestServer(new RoomManager({ seed: () => 5 }));
    const [ana, ben] = await Promise.all([1, 2].map(() => server!.connect()));
    const created = await send<JoinResult>(ana!, 'room:create', {
      name: 'Ana',
      game: 'pandemic',
      config: { players: 2 },
    });
    if (!created.ok) throw new Error('create failed');
    expect(await send(ana!, 'room:choose-seat', { seat: 'p2' })).toEqual({
      ok: false,
      error: 'not-allowed',
    });
    const move = (client: Client, matchId: string, seq: number) =>
      send(client, 'match:move', { matchId, seq, move: { type: 'pass' } });
    // Alone at the table, nobody may move yet.
    expect(await move(ana!, created.matchId, 1)).toEqual({ ok: false, error: 'not-started' });
    await send(ben!, 'room:join', { code: created.code, name: 'Ben' });
    const results = await Promise.all([
      move(ana!, created.matchId, 2),
      move(ben!, created.matchId, 1),
    ]);
    // Exactly one of the two is on turn.
    expect(results.filter((r) => (r as { ok: boolean }).ok)).toHaveLength(1);
  });
});
