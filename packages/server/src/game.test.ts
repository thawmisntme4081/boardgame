import {
  beginGame,
  createGame,
  isGameOver,
  SCENARIO_LIST,
  viewFor,
  YUL,
  type AckResult,
  type DieValue,
  type GameState,
  type JoinResult,
  type PlayerView,
  type Scenario,
  type Seat,
} from '@sky/shared';
import { applyAgentAction, createRandomAgent, playRandomGame } from '@sky/shared/random-play';
import { afterEach, describe, expect, it } from 'vitest';
import { RoomManager } from './rooms';
import { next, startTestServer, takeOff, type Client } from './test-server';

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
  // Round 1 waits for the crew: keep the seats and confirm (a no-op later in the game).
  await takeOff(clients.pilot, clients.copilot);
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
    await takeOff(clients.pilot, clients.copilot);
    let mirror: GameState = beginGame(createGame(YUL, seed, { setup: true }));
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
    // Everything else is already deployed: the landing is certain once the speed is set.
    expectOk(await place('copilot', 'r7-c2', 'engineCopilot'));
    // The game is over: the dice still in hand are not needed.
    expect(await place('pilot', 'r7-p3', 'concentration1')).toEqual({
      ok: false,
      error: 'game-over',
    });

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
    expect(room().game.phase).toBe('setup');
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
    await bothReady(clients);
    expect(await clients.pilot.emitWithAck('game:rematch', {})).toEqual({
      ok: false,
      error: 'game-not-over',
    });

    room().game = { ...room().game, phase: 'lost', endReason: 'spin', round: 4, axis: 3 };
    room().players.pilot!.ready = true;
    const view = next(clients.copilot, 'game:view');
    expectOk(await clients.copilot.emitWithAck('game:rematch', {}));
    expect(await view).toMatchObject({ phase: 'setup', round: 1, axis: 0, seat: 'copilot' });
    expect(room().code).toBe(code);
    expect(room().players.pilot).toMatchObject({ name: 'Ana', ready: false });
    expect(room().game.log).toEqual([]);
  });
});

describe('robustness', () => {
  it('rejoining mid-round resumes exactly where the player was', async () => {
    const { clients, room, code } = await seatedRoom();
    await bothReady(clients);
    const die = room().game.dice.pilot[1]!;
    expectOk(
      await clients.pilot.emitWithAck('game:place', {
        dieId: die.id,
        slot: 'axisPilot',
        coffeeDelta: 0,
      }),
    );
    const before = viewFor(room().game, 'pilot');
    const token = room().players.pilot!.token;

    clients.pilot.disconnect();
    const back = await server!.connect();
    const view = next(back, 'game:view');
    expect(await back.emitWithAck('room:rejoin', { code, token })).toMatchObject({
      ok: true,
      seat: 'pilot',
    });
    expect(await view).toEqual(before);
    expect((await view).myDice).toHaveLength(3);
  });

  it('accepts a double-tapped move once', async () => {
    const { clients, room } = await seatedRoom();
    await bothReady(clients);
    const intent = {
      dieId: room().game.dice.pilot[0]!.id,
      slot: 'axisPilot',
      coffeeDelta: 0,
    } as const;
    const [first, second] = await Promise.all([
      clients.pilot.emitWithAck('game:place', intent),
      clients.pilot.emitWithAck('game:place', intent),
    ]);
    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(room().game.log.filter((e) => e.type === 'place')).toHaveLength(1);
    expect(room().game.dice.pilot).toHaveLength(3);
    expect(room().game.currentSeat).toBe('copilot');
  });

  it('still rejects a different move with an already placed die', async () => {
    const { clients, room } = await seatedRoom();
    await bothReady(clients);
    const dieId = room().game.dice.pilot[0]!.id;
    expectOk(
      await clients.pilot.emitWithAck('game:place', { dieId, slot: 'axisPilot', coffeeDelta: 0 }),
    );
    expect(
      await clients.pilot.emitWithAck('game:place', { dieId, slot: 'enginePilot', coffeeDelta: 0 }),
    ).toEqual({ ok: false, error: 'not-your-turn' });
  });

  it('treats a new game waiting for the crew as fresh: both "Fly again" are OK', async () => {
    const traffic = pick((s) => (s.traffic?.[0] ?? 0) > 0);
    server = await startTestServer(new RoomManager({ seed: () => 1 }));
    const pilot = await server.connect();
    const copilot = await server.connect();
    const { code } = joined(
      await pilot.emitWithAck('room:create', {
        name: 'Ana',
        scenario: traffic.id,
      }),
    );
    joined(await copilot.emitWithAck('room:join', { code, name: 'Ben' }));
    const room = server.rooms.get(code)!;
    room.game = { ...room.game, phase: 'lost', endReason: 'spin' };
    expectOk(await pilot.emitWithAck('game:rematch', {}));
    const fresh = room.game;
    // Round 1 has not started: even the traffic die waits for both players to confirm.
    expect(fresh).toMatchObject({ phase: 'setup', log: [] });
    expectOk(await copilot.emitWithAck('game:rematch', {}));
    expect(room.game).toBe(fresh);
  });

  it('starts one new game when both players press "Fly again"', async () => {
    let seeds = 0;
    server = await startTestServer(new RoomManager({ seed: () => ++seeds }));
    const pilot = await server.connect();
    const copilot = await server.connect();
    const { code } = joined(await pilot.emitWithAck('room:create', { name: 'Ana' }));
    joined(await copilot.emitWithAck('room:join', { code, name: 'Ben' }));
    const room = server.rooms.get(code)!;
    room.game = { ...room.game, phase: 'lost', endReason: 'spin' };

    const [a, b] = await Promise.all([
      pilot.emitWithAck('game:rematch', {}),
      copilot.emitWithAck('game:rematch', {}),
    ]);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(seeds).toBe(2); // the room's first game + exactly one rematch
    expect(room.game.phase).toBe('setup');
  });

  it('leaving frees the seat, restarts the partner and lets someone new join', async () => {
    const { clients, room, code } = await seatedRoom();
    await bothReady(clients);

    const presence = next(clients.copilot, 'room:presence');
    const view = next(clients.copilot, 'game:view');
    expectOk(await clients.pilot.emitWithAck('room:leave', {}));
    expect((await presence).pilot).toBeNull();
    expect(await view).toMatchObject({ phase: 'setup', round: 1, myDice: [] });
    expect(await clients.pilot.emitWithAck('game:ready', {})).toEqual({
      ok: false,
      error: 'not-in-room',
    });

    const newcomer = await server!.connect();
    expect(await newcomer.emitWithAck('room:join', { code, name: 'Cat' })).toMatchObject({
      ok: true,
      seat: 'pilot',
    });
    expect(room().players.pilot?.name).toBe('Cat');
  });

  it('deletes the room when both players leave', async () => {
    const { clients, code } = await seatedRoom();
    expectOk(await clients.pilot.emitWithAck('room:leave', {}));
    expectOk(await clients.copilot.emitWithAck('room:leave', {}));
    expect(server!.rooms.get(code)).toBeUndefined();
    expect(await clients.pilot.emitWithAck('room:leave', {})).toEqual({
      ok: false,
      error: 'not-in-room',
    });
  });

  it('limits how many rooms one address can create', async () => {
    server = await startTestServer(new RoomManager({ maxRoomsPerIp: 1 }));
    const first = await server.connect();
    const second = await server.connect();
    expect((await first.emitWithAck('room:create', { name: 'Ana' })).ok).toBe(true);
    expect(await second.emitWithAck('room:create', { name: 'Ana' })).toEqual({
      ok: false,
      error: 'too-many-rooms',
    });
  });
});

describe('round timer', () => {
  /** A room created with or without the timer, both players seated, views recorded. */
  async function timedRoom(timer: boolean, roundTimerMs: number) {
    server = await startTestServer(new RoomManager({ seed: () => 1, roundTimerMs }));
    const pilot = await server.connect();
    const copilot = await server.connect();
    const views: Record<Seat, PlayerView[]> = { pilot: [], copilot: [] };
    pilot.on('game:view', (v) => views.pilot.push(v));
    copilot.on('game:view', (v) => views.copilot.push(v));
    const { code } = joined(await pilot.emitWithAck('room:create', { name: 'Ana', timer }));
    joined(await copilot.emitWithAck('room:join', { code, name: 'Ben' }));
    const clients = { pilot, copilot };
    return { clients, views, room: () => server!.rooms.get(code)!, code };
  }

  it('is off by default: no countdown after the roll', async () => {
    const { clients, views } = await timedRoom(false, 5_000);
    await bothReady(clients);
    expect(views.pilot.at(-1)).toMatchObject({ timerMs: null, roundTimeLeftMs: null });
  });

  it('starts when both are ready and ends the game for both when time runs out', async () => {
    const { clients, views, room } = await timedRoom(true, 300);
    expect(views.pilot.at(-1)).toMatchObject({ timerMs: 300, roundTimeLeftMs: null });
    await bothReady(clients);
    const rolled = views.copilot.at(-1)!;
    expect(rolled.roundTimeLeftMs).toBeGreaterThan(0);
    expect(rolled.roundTimeLeftMs).toBeLessThanOrEqual(300);

    await waitFor(() => views.pilot.at(-1)?.phase === 'lost', 'time-up view (pilot)');
    await waitFor(() => views.copilot.at(-1)?.phase === 'lost', 'time-up view (copilot)');
    expect(views.pilot.at(-1)).toMatchObject({ endReason: 'time-up', roundTimeLeftMs: null });
    expect(room().game).toMatchObject({ phase: 'lost', endReason: 'time-up', deadline: null });

    // A move that arrives too late is refused; a rematch keeps the game timed.
    expect(
      await clients.pilot.emitWithAck('game:place', {
        dieId: 'r1-p1',
        slot: 'axisPilot',
        coffeeDelta: 0,
      }),
    ).toEqual({ ok: false, error: 'game-over' });
    expectOk(await clients.pilot.emitWithAck('game:rematch', {}));
    expect(room().game).toMatchObject({ timerMs: 300, deadline: null, phase: 'setup' });
  });

  it('stops when the last die of the round is placed in time', async () => {
    const { clients, room } = await timedRoom(true, 1_500);
    await bothReady(clients);
    // Known dice for a quick, harmless round (level axis, speed 4).
    const values = [2, 2, 3, 3] as const;
    room().game = {
      ...room().game,
      dice: {
        pilot: values.map((value, i) => ({ id: `r1-p${i + 1}`, value })),
        copilot: values.map((value, i) => ({ id: `r1-c${i + 1}`, value })),
      },
    };
    const place = (seat: Seat, n: number, slot: string) =>
      clients[seat].emitWithAck('game:place', {
        dieId: `r1-${seat === 'pilot' ? 'p' : 'c'}${n}`,
        slot,
        coffeeDelta: 0,
      } as never);
    expectOk(await place('pilot', 1, 'axisPilot'));
    expectOk(await place('copilot', 1, 'axisCopilot'));
    expectOk(await place('pilot', 2, 'enginePilot'));
    expectOk(await place('copilot', 2, 'engineCopilot'));
    expectOk(await place('pilot', 3, 'concentration1'));
    expectOk(await place('copilot', 3, 'concentration2'));
    expectOk(await place('pilot', 4, 'radioPilot'));
    expectOk(await place('copilot', 4, 'radioCopilot1'));

    expect(room().game).toMatchObject({ phase: 'strategy', round: 2, deadline: null });
    await new Promise((r) => setTimeout(r, 1_700)); // past the old deadline
    expect(room().game).toMatchObject({ phase: 'strategy', round: 2 });
    expect(room().roundTimer).toBeUndefined();
  });
});

describe('total trust', () => {
  it('rolls the next round by itself once the pause is over, with nobody pressing "Roll dice"', async () => {
    server = await startTestServer(new RoomManager({ seed: () => 1, nextTurnMs: 200 }));
    const pilot = await server.connect();
    const copilot = await server.connect();
    const views: PlayerView[] = [];
    copilot.on('game:view', (v) => views.push(v));
    const { code } = joined(await pilot.emitWithAck('room:create', { name: 'Ana' }));
    joined(await copilot.emitWithAck('room:join', { code, name: 'Ben' }));
    const room = () => server!.rooms.get(code)!;
    // A Total Trust symbol on the starting space: a round that ends there skips the next talk.
    room().game = {
      ...room().game,
      scenario: {
        ...room().game.scenario,
        modules: ['total-trust'],
        totalTrust: room().game.scenario.approach.map((_, i) => (i === 0 ? 1 : 0)),
      },
    };
    await bothReady({ pilot, copilot });
    const values = [2, 2, 3, 3] as const;
    room().game = {
      ...room().game,
      dice: {
        pilot: values.map((value, i) => ({ id: `r1-p${i + 1}`, value })),
        copilot: values.map((value, i) => ({ id: `r1-c${i + 1}`, value })),
      },
    };
    const clients = { pilot, copilot };
    const place = (seat: Seat, n: number, slot: string) =>
      clients[seat].emitWithAck('game:place', {
        dieId: `r1-${seat === 'pilot' ? 'p' : 'c'}${n}`,
        slot,
        coffeeDelta: 0,
      } as never);
    // A harmless round: level axis, speed 4, the plane stays on the Total Trust space.
    expectOk(await place('pilot', 1, 'axisPilot'));
    expectOk(await place('copilot', 1, 'axisCopilot'));
    expectOk(await place('pilot', 2, 'enginePilot'));
    expectOk(await place('copilot', 2, 'engineCopilot'));
    expectOk(await place('pilot', 3, 'concentration1'));
    expectOk(await place('copilot', 3, 'concentration2'));
    expectOk(await place('pilot', 4, 'radioPilot'));
    expectOk(await place('copilot', 4, 'radioCopilot1'));

    expect(views.at(-1)).toMatchObject({ phase: 'strategy', round: 2, autoRoll: true });
    await waitFor(() => views.at(-1)?.phase === 'placing', 'the automatic roll');
    expect(views.at(-1)).toMatchObject({ round: 2 });
    expect(room().autoRollAt).toBeUndefined();
  });
});

/** The first active scenario that matches: tests don't depend on which ones scenarios.ts lists. */
function pick(match: (s: Scenario) => boolean): Scenario {
  const found = SCENARIO_LIST.find(match);
  if (!found) throw new Error('no active scenario matches this test');
  return found;
}

describe('scenarios and special abilities', () => {
  const kerosene = () => pick((s) => s.modules.includes('kerosene') && s.abilities === 2);
  const oneAbility = () => pick((s) => s.abilities === 1);
  const noAbility = () => pick((s) => s.abilities === 0 && s.id !== 'yul-green');

  it('creates the chosen scenario; each player then picks a card before round 1', async () => {
    server = await startTestServer(new RoomManager({ seed: () => 1 }));
    const pilot = await server.connect();
    const copilot = await server.connect();
    const { code } = joined(
      await pilot.emitWithAck('room:create', { name: 'Ana', scenario: kerosene().id }),
    );
    joined(await copilot.emitWithAck('room:join', { code, name: 'Ben' }));
    const room = server.rooms.get(code)!;
    expect(room.game.scenario.id).toBe(kerosene().id);
    expect(room.game.kerosene).toBe(20);

    // Round 1 waits for both cards; never the same card twice.
    expectOk(await pilot.emitWithAck('room:choose-seat', { seat: 'pilot' }));
    expect(await pilot.emitWithAck('game:confirm', {})).toEqual({
      ok: false,
      error: 'abilities-missing',
    });
    expectOk(await pilot.emitWithAck('game:pick-ability', { ability: 'control' }));
    expect(await copilot.emitWithAck('game:pick-ability', { ability: 'control' })).toEqual({
      ok: false,
      error: 'ability-taken',
    });
    expectOk(await copilot.emitWithAck('game:pick-ability', { ability: 'working-together' }));
    expect(room.game.abilities).toEqual(['control', 'working-together']);
    expect(await pilot.emitWithAck('game:pick-ability', { ability: 'flying' } as never)).toEqual({
      ok: false,
      error: 'bad-request',
    });

    const b = await server.connect();
    expect(await b.emitWithAck('room:create', { name: 'Ben', scenario: 'nowhere' })).toEqual({
      ok: false,
      error: 'bad-request',
    });
  });

  it('lets the creator take the co-pilot seat over sockets', async () => {
    const { clients, room } = await seatedRoom();
    const moved = new Promise<PlayerView>((resolve) =>
      clients.pilot.on('game:view', (v) => v.seat === 'copilot' && resolve(v)),
    );
    expectOk(await clients.pilot.emitWithAck('room:choose-seat', { seat: 'copilot' }));
    expect((await moved).phase).toBe('setup');
    expect(room().players.pilot?.name).toBe('Ben');
    // The tab that created the game now sits in the co-pilot seat.
    expectOk(await clients.pilot.emitWithAck('game:confirm', {}));
    expectOk(await clients.copilot.emitWithAck('game:confirm', {}));
    expect(room().game.phase).toBe('strategy');
    expect(await clients.pilot.emitWithAck('room:choose-seat', { seat: 'pilot' })).toEqual({
      ok: false,
      error: 'setup-closed',
    });
  });

  it('plays abilities over sockets: a Working Together swap', async () => {
    server = await startTestServer(new RoomManager({ seed: () => 1 }));
    const clients: Record<Seat, Client> = {
      pilot: await server.connect(),
      copilot: await server.connect(),
    };
    const { code } = joined(
      await clients.pilot.emitWithAck('room:create', { name: 'Ana', scenario: oneAbility().id }),
    );
    joined(await clients.copilot.emitWithAck('room:join', { code, name: 'Ben' }));
    // One card: the creator picks it.
    expectOk(await clients.pilot.emitWithAck('game:pick-ability', { ability: 'working-together' }));
    await bothReady(clients);
    const room = server.rooms.get(code)!;
    const [pilotDie] = room.game.dice.pilot;
    const [copilotDie] = room.game.dice.copilot;

    const offered = next(clients.copilot, 'game:view');
    expectOk(
      await clients.pilot.emitWithAck('game:ability', {
        ability: 'working-together',
        dieId: pilotDie!.id,
      }),
    );
    expect((await offered).swap).toEqual({ seat: 'pilot', value: pilotDie!.value });
    expect(
      await clients.pilot.emitWithAck('game:ability', {
        ability: 'adaptation',
        dieId: pilotDie!.id,
      }),
    ).toEqual({ ok: false, error: 'ability-unavailable' });
    expect(
      await clients.pilot.emitWithAck('game:ability', { ability: 'control', dieId: 'x' } as never),
    ).toEqual({ ok: false, error: 'bad-request' });

    expectOk(
      await clients.copilot.emitWithAck('game:ability', {
        ability: 'working-together',
        dieId: copilotDie!.id,
      }),
    );
    expect(room.game.swap).toBeNull();
    expect(room.game.dice.pilot[0]!.value).toBe(copilotDie!.value);
    expect(room.game.dice.copilot[0]!.value).toBe(pilotDie!.value);
  });

  it('switches scenario on a rematch, or before the first roll', async () => {
    const { clients, room } = await seatedRoom();
    const switched = next(clients.copilot, 'game:view');
    expectOk(await clients.pilot.emitWithAck('game:rematch', { scenario: noAbility().id }));
    expect((await switched).scenario.id).toBe(noAbility().id);
    const before = room().game;
    // The partner's identical request finds the new game and changes nothing.
    expectOk(await clients.copilot.emitWithAck('game:rematch', { scenario: noAbility().id }));
    expect(room().game).toBe(before);
    expect(await clients.pilot.emitWithAck('game:rematch', { scenario: 'nowhere' })).toEqual({
      ok: false,
      error: 'bad-request',
    });

    await bothReady(clients);
    expect(await clients.pilot.emitWithAck('game:rematch', { scenario: 'yul-green' })).toEqual({
      ok: false,
      error: 'game-not-over',
    });
    room().game = { ...room().game, phase: 'lost', endReason: 'kerosene' };
    expectOk(await clients.copilot.emitWithAck('game:rematch', { scenario: oneAbility().id }));
    expect(room().game.scenario.id).toBe(oneAbility().id);
    // Abilities are picked again in the new game (nobody had picked a card yet).
    expect(room().game.abilities).toEqual([]);
    // No setup: the same scenario again.
    room().game = { ...room().game, phase: 'lost', endReason: 'spin' };
    expectOk(await clients.copilot.emitWithAck('game:rematch', {}));
    expect(room().game.scenario.id).toBe(oneAbility().id);
    expect(room().game.phase).toBe('setup');
  });
});
