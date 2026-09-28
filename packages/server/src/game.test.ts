import {
  createGame,
  isGameOver,
  viewFor,
  YUL,
  type AckResult,
  type DieValue,
  type GameState,
  type JoinResult,
  type PlayerView,
  type Seat,
} from '@sky/shared';
import { applyAgentAction, createRandomAgent, playRandomGame } from '@sky/shared/random-play';
import { afterEach, describe, expect, it } from 'vitest';
import { RoomManager } from './rooms';
import { next, startTestServer, type Client } from './test-server';

let server: Awaited<ReturnType<typeof startTestServer>> | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

function joined(result: JoinResult) {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result;
}

function expectOk(result: AckResult) {
  expect(result).toEqual({ ok: true });
}

/** A seeded room with both seats taken; every game:view each client receives is recorded. */
async function seatedRoom(seed = 1) {
  server = await startTestServer(new RoomManager({ seed: () => seed }));
  const clients: Record<Seat, Client> = {
    pilot: await server.connect(),
    copilot: await server.connect(),
  };
  const views: Record<Seat, PlayerView[]> = { pilot: [], copilot: [] };
  for (const seat of ['pilot', 'copilot'] as const) {
    clients[seat].on('game:view', (view) => views[seat].push(view));
  }
  const { code } = joined(await clients.pilot.emitWithAck('room:create', { name: 'Ana' }));
  const copilotView = next(clients.copilot, 'game:view');
  joined(await clients.copilot.emitWithAck('room:join', { code, name: 'Ben' }));
  await copilotView;
  const room = () => server!.rooms.get(code)!;
  return { clients, views, code, room };
}

/** Resolves on the first view that has been rolled (placing). */
function rolledView(client: Client): Promise<PlayerView> {
  return new Promise((resolve) => {
    const listener = (view: PlayerView) => {
      if (view.phase !== 'placing') return;
      client.off('game:view', listener);
      resolve(view);
    };
    client.on('game:view', listener);
  });
}

async function bothReady(clients: Record<Seat, Client>) {
  const rolled = [rolledView(clients.pilot), rolledView(clients.copilot)];
  expectOk(await clients.pilot.emitWithAck('game:ready', {}));
  expectOk(await clients.copilot.emitWithAck('game:ready', {}));
  await Promise.all(rolled);
}

async function waitFor(condition: () => boolean, what: string) {
  for (let i = 0; i < 200; i++) {
    if (condition()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** Each broadcast sends one view per seat; pair them up and check nothing secret leaks. */
function expectNoLeaks(views: Record<Seat, PlayerView[]>) {
  // The pilot also got a view when creating the room, before the co-pilot was seated.
  const pilotViews = views.pilot.slice(1);
  expect(pilotViews).toHaveLength(views.copilot.length);
  pilotViews.forEach((p, i) => {
    const c = views.copilot[i]!;
    expect(p.partnerDiceLeft).toBe(c.myDice.length);
    expect(c.partnerDiceLeft).toBe(p.myDice.length);
    const pJson = JSON.stringify(p);
    const cJson = JSON.stringify(c);
    for (const die of c.myDice) expect(pJson).not.toContain(`"${die.id}"`);
    for (const die of p.myDice) expect(cJson).not.toContain(`"${die.id}"`);
    for (const json of [pJson, cJson]) expect(json).not.toMatch(/rngSeed|rngState|"log"|"dice"/);
  });
}

describe('a full game over sockets', () => {
  it('plays to the end exactly like the in-process game and never leaks partner dice', async () => {
    const seed = 1;
    const { clients, views, room } = await seatedRoom(seed);
    const agent = createRandomAgent(seed);
    let mirror: GameState = createGame(YUL, seed);
    let actions = 0;

    while (!isGameOver(room().game)) {
      expect(room().game).toEqual(mirror);
      const action = agent(room().game);
      mirror = applyAgentAction(mirror, action);
      actions++;
      switch (action.type) {
        case 'roll':
          expectOk(await clients.pilot.emitWithAck('game:ready', {}));
          expectOk(await clients.copilot.emitWithAck('game:ready', {}));
          break;
        case 'spend-reroll':
          expectOk(await clients[action.seat].emitWithAck('game:spend-reroll', {}));
          break;
        case 'reroll':
          expectOk(
            await clients[action.seat].emitWithAck('game:reroll', { dieIds: action.dieIds }),
          );
          break;
        case 'place':
          expectOk(await clients[action.seat].emitWithAck('game:place', action.intent));
          break;
      }
    }

    const end = room().game;
    expect(end).toEqual(mirror);
    expect(end).toEqual(playRandomGame(seed));
    expect(end.round).toBeGreaterThanOrEqual(6);
    expect(actions).toBeGreaterThan(40);

    await waitFor(
      () => views.pilot.at(-1)?.phase === end.phase && views.copilot.at(-1)?.phase === end.phase,
      'game over views',
    );
    for (const seat of ['pilot', 'copilot'] as const) {
      expect(views[seat].at(-1)).toEqual(viewFor(end, seat));
      expect(views[seat].at(-1)?.endReason).toBe(end.endReason);
    }
    expectNoLeaks(views);
  }, 30_000);

  it('broadcasts a landing to both players', async () => {
    const { clients, views, room } = await seatedRoom();
    // Jump to a ready-to-land final round with known dice.
    const dice = (seat: 'p' | 'c', values: DieValue[]) =>
      values.map((value, i) => ({ id: `r7-${seat}${i + 1}`, value }));
    room().game = {
      ...room().game,
      phase: 'placing',
      round: 7,
      currentSeat: 'pilot',
      approachIndex: 6,
      approachPlanes: [0, 0, 0, 0, 0, 0, 0],
      gear: [true, true, true],
      flaps: [true, true, true, true],
      aeroBlue: 7,
      aeroOrange: 12,
      brakes: 2,
      dice: { pilot: dice('p', [3, 2, 3, 3]), copilot: dice('c', [3, 2, 3, 3]) },
    };
    const place = (seat: Seat, dieId: string, slot: string) =>
      clients[seat].emitWithAck('game:place', { dieId, slot, coffeeDelta: 0 } as never);

    expectOk(await place('pilot', 'r7-p1', 'axisPilot'));
    expectOk(await place('copilot', 'r7-c1', 'axisCopilot'));
    expectOk(await place('pilot', 'r7-p2', 'enginePilot'));
    expectOk(await place('copilot', 'r7-c2', 'engineCopilot'));
    expectOk(await place('pilot', 'r7-p3', 'concentration1'));
    expectOk(await place('copilot', 'r7-c3', 'concentration2'));
    expectOk(await place('pilot', 'r7-p4', 'radioPilot'));
    expectOk(await place('copilot', 'r7-c4', 'radioCopilot1'));

    expect(room().game.phase).toBe('won');
    await waitFor(
      () => views.pilot.at(-1)?.phase === 'won' && views.copilot.at(-1)?.phase === 'won',
      'won views',
    );
    expect(views.copilot.at(-1)).toMatchObject({ phase: 'won', speed: 4, finalRound: true });
  });
});

describe('game:place', () => {
  it('sends fresh views to both seats after each move', async () => {
    const { clients, views, room } = await seatedRoom();
    await bothReady(clients);
    const die = room().game.dice.pilot[0]!;
    const pilotView = next(clients.pilot, 'game:view');
    const copilotView = next(clients.copilot, 'game:view');
    expectOk(
      await clients.pilot.emitWithAck('game:place', {
        dieId: die.id,
        slot: 'axisPilot',
        coffeeDelta: 0,
      }),
    );
    expect((await pilotView).myDice).toHaveLength(3);
    const seen = await copilotView;
    expect(seen.placed.axisPilot).toEqual({ seat: 'pilot', dieId: die.id, value: die.value });
    expect(seen).toMatchObject({ partnerDiceLeft: 3, currentSeat: 'copilot' });
    expect(views.copilot.length).toBeGreaterThan(0);
  });

  it('rejects illegal moves with the rule reason and changes nothing', async () => {
    const { clients, room } = await seatedRoom();
    await bothReady(clients);
    const before = structuredClone(room().game);
    const pilotDie = room().game.dice.pilot[0]!.id;
    const copilotDie = room().game.dice.copilot[0]!.id;

    const tries: [Client, unknown, string][] = [
      [
        clients.copilot,
        { dieId: copilotDie, slot: 'axisCopilot', coffeeDelta: 0 },
        'not-your-turn',
      ],
      [clients.pilot, { dieId: copilotDie, slot: 'axisPilot', coffeeDelta: 0 }, 'unknown-die'],
      [clients.pilot, { dieId: pilotDie, slot: 'flaps1', coffeeDelta: 0 }, 'wrong-seat'],
      [clients.pilot, { dieId: pilotDie, slot: 'axisPilot', coffeeDelta: 1 }, 'not-enough-coffee'],
      [clients.pilot, { dieId: pilotDie, slot: 'wings', coffeeDelta: 0 }, 'bad-request'],
      [clients.pilot, { dieId: pilotDie, slot: 'axisPilot', coffeeDelta: 9 }, 'bad-request'],
      [clients.pilot, { dieId: pilotDie, slot: 'axisPilot' }, 'bad-request'],
      [clients.pilot, 'axisPilot', 'bad-request'],
    ];
    for (const [client, payload, error] of tries) {
      expect(await client.emitWithAck('game:place', payload as never)).toEqual({
        ok: false,
        error,
      });
    }
    expect(room().game).toEqual(before);
  });

  it('refuses moves before the roll and from sockets without a seat', async () => {
    const { clients, room } = await seatedRoom();
    expect(
      await clients.pilot.emitWithAck('game:place', {
        dieId: 'r1-p1',
        slot: 'axisPilot',
        coffeeDelta: 0,
      }),
    ).toEqual({ ok: false, error: 'not-placing' });
    const stranger = await server!.connect();
    expect(
      await stranger.emitWithAck('game:place', {
        dieId: 'r1-p1',
        slot: 'axisPilot',
        coffeeDelta: 0,
      }),
    ).toEqual({ ok: false, error: 'not-in-room' });
    expect(room().game.phase).toBe('strategy');
  });
});

describe('rerolls over sockets', () => {
  it('spends a token, then each player rerolls only their own dice once', async () => {
    const { clients, room } = await seatedRoom();
    await bothReady(clients);
    expect(await clients.pilot.emitWithAck('game:reroll', { dieIds: [] })).toEqual({
      ok: false,
      error: 'no-reroll-pending',
    });

    const pending = next(clients.pilot, 'game:view');
    expectOk(await clients.copilot.emitWithAck('game:spend-reroll', {}));
    expect((await pending).rerollPending).toEqual({ pilot: true, copilot: true });
    expect(await clients.copilot.emitWithAck('game:spend-reroll', {})).toEqual({
      ok: false,
      error: 'no-reroll',
    });

    const pilotIds = room().game.dice.pilot.map((d) => d.id);
    expect(await clients.copilot.emitWithAck('game:reroll', { dieIds: [pilotIds[0]!] })).toEqual({
      ok: false,
      error: 'unknown-die',
    });
    expectOk(await clients.pilot.emitWithAck('game:reroll', { dieIds: pilotIds.slice(0, 2) }));
    expect(room().game.rerollPending).toEqual({ pilot: false, copilot: true });
    expect(await clients.pilot.emitWithAck('game:reroll', { dieIds: [] })).toEqual({
      ok: false,
      error: 'no-reroll-pending',
    });
    expect(
      await clients.copilot.emitWithAck('game:reroll', { dieIds: ['a', 'b', 'c', 'd', 'e'] }),
    ).toEqual({ ok: false, error: 'bad-request' });
  });
});

describe('game:rematch', () => {
  it('only works once the game is over, then starts a fresh game in the same room', async () => {
    const { clients, room, code } = await seatedRoom();
    expect(await clients.pilot.emitWithAck('game:rematch', {})).toEqual({
      ok: false,
      error: 'game-not-over',
    });

    room().game = { ...room().game, phase: 'lost', endReason: 'spin', round: 4, axis: 3 };
    room().players.pilot!.ready = true;
    const view = next(clients.copilot, 'game:view');
    expectOk(await clients.copilot.emitWithAck('game:rematch', {}));
    expect(await view).toMatchObject({ phase: 'strategy', round: 1, axis: 0, seat: 'copilot' });
    expect(room().code).toBe(code);
    expect(room().players.pilot).toMatchObject({ name: 'Ana', ready: false });
    expect(room().game.log).toEqual([]);
  });
});
