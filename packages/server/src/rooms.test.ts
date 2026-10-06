import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCENARIO_LIST, type Scenario } from '@sky/shared';
import { game } from './games';
import { ROOM_CODE_ALPHABET, RoomManager, type Room } from './rooms';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe('RoomManager', () => {
  it('creates a room with a 4-letter code and seats the creator as pilot', () => {
    const rooms = new RoomManager();
    const { room, player } = unwrap(rooms.create('Ana', 's1'));
    expect(room.code).toMatch(/^[A-Z]{4}$/);
    expect([...room.code].every((c) => ROOM_CODE_ALPHABET.includes(c))).toBe(true);
    expect(player).toMatchObject({ seat: 'pilot', name: 'Ana', socketId: 's1', creator: true });
    expect(player.token).toMatch(UUID);
    // Round 1 waits until the crew has chosen roles and abilities.
    expect(room.game.phase).toBe('setup');
    expect(rooms.size).toBe(1);
  });

  it('never reuses a live room code', () => {
    const rooms = new RoomManager();
    const codes = new Set<string>();
    for (let i = 0; i < 500; i++) {
      codes.add(unwrap(rooms.create('P', `s${i}`, `10.0.${i >> 8}.${i & 255}`)).room.code);
    }
    expect(codes.size).toBe(500);
  });

  it('seats the second player as co-pilot and refuses a third', () => {
    const rooms = new RoomManager();
    const { room } = unwrap(rooms.create('Ana', 's1'));
    const second = unwrap(rooms.join(room.code, 'Ben', 's2'));
    expect(second.player.seat).toBe('copilot');
    expect(second.player.token).not.toBe(room.players.pilot!.token);
    expect(rooms.join(room.code, 'Cat', 's3')).toEqual({ ok: false, error: 'room-full' });
    expect(rooms.join('ZZZZ', 'Cat', 's3')).toEqual({ ok: false, error: 'room-not-found' });
  });

  it('refuses a socket that already has a seat', () => {
    const rooms = new RoomManager();
    const { room } = unwrap(rooms.create('Ana', 's1'));
    expect(rooms.create('Ana', 's1')).toEqual({ ok: false, error: 'already-in-room' });
    expect(rooms.join(room.code, 'Ana', 's1')).toEqual({ ok: false, error: 'already-in-room' });
  });

  it('keeps the seat after a disconnect and restores it with the token', () => {
    const rooms = new RoomManager();
    const { room, player } = unwrap(rooms.create('Ana', 's1'));
    rooms.disconnect('s1');
    expect(player.socketId).toBeNull();
    expect(rooms.bySocket('s1')).toBeUndefined();
    expect(rooms.presence(room).pilot).toEqual({ name: 'Ana', online: false, creator: true });

    expect(rooms.rejoin(room.code, 'not-the-token', 's9')).toEqual({
      ok: false,
      error: 'bad-token',
    });
    const back = unwrap(rooms.rejoin(room.code, player.token, 's9'));
    expect(back.player).toBe(player);
    expect(player.socketId).toBe('s9');
    expect(rooms.bySocket('s9')?.player).toBe(player);
  });

  it('moves a seat to the new socket when rejoining without a disconnect', () => {
    const rooms = new RoomManager();
    const { room, player } = unwrap(rooms.create('Ana', 's1'));
    unwrap(rooms.rejoin(room.code, player.token, 's2'));
    expect(rooms.bySocket('s1')).toBeUndefined();
    expect(rooms.bySocket('s2')?.player.seat).toBe('pilot');
  });

  it('reports presence for both seats', () => {
    const rooms = new RoomManager();
    const { room } = unwrap(rooms.create('Ana', 's1'));
    expect(rooms.presence(room)).toEqual({
      pilot: { name: 'Ana', online: true, creator: true },
      copilot: null,
    });
    // The game hears who sits at the table.
    expect(room.game.crew.seated).toEqual({ pilot: true, copilot: false });
    unwrap(rooms.join(room.code, 'Ben', 's2'));
    expect(room.game.crew.seated).toEqual({ pilot: true, copilot: true });
  });

  it('tracks activity time', () => {
    let now = 1000;
    const rooms = new RoomManager({ now: () => now });
    const { room } = unwrap(rooms.create('Ana', 's1'));
    expect(room.createdAt).toBe(1000);
    now = 5000;
    unwrap(rooms.join(room.code, 'Ben', 's2'));
    expect(room.lastActivity).toBe(5000);
  });

  it('limits live rooms per IP address', () => {
    const rooms = new RoomManager({ maxRoomsPerIp: 2 });
    unwrap(rooms.create('A', 's1', '1.2.3.4'));
    const second = unwrap(rooms.create('B', 's2', '1.2.3.4'));
    expect(rooms.create('C', 's3', '1.2.3.4')).toEqual({ ok: false, error: 'too-many-rooms' });
    expect(rooms.create('D', 's4', '5.6.7.8').ok).toBe(true);
    // Leaving an empty room frees the slot.
    rooms.leave('s2');
    expect(rooms.get(second.room.code)).toBeUndefined();
    expect(rooms.create('C', 's3', '1.2.3.4').ok).toBe(true);
  });

  it('frees the seat on leave and restarts the game for the partner', () => {
    let seed = 100;
    const rooms = new RoomManager({ seed: () => seed++ });
    const { room } = unwrap(rooms.create('Ana', 's1'));
    const pilotToken = room.players.pilot!.token;
    unwrap(rooms.join(room.code, 'Ben', 's2'));
    room.game.crew.ready.copilot = true;
    room.game = { ...room.game, round: 3, log: [{ type: 'round-end', round: 2 }] };

    const left = rooms.leave('s1');
    expect(left).toMatchObject({ closed: false, player: { name: 'Ana', seat: 'pilot' } });
    expect(room.players.pilot).toBeUndefined();
    expect(rooms.bySocket('s1')).toBeUndefined();
    expect(room.game).toMatchObject({ round: 1, phase: 'setup', log: [], rngSeed: 101 });
    expect(room.game.crew).toMatchObject({ host: 'copilot', ready: { copilot: false } });
    expect(rooms.rejoin(room.code, pilotToken, 's9')).toEqual({ ok: false, error: 'bad-token' });

    // Someone new takes the free pilot seat.
    expect(unwrap(rooms.join(room.code, 'Cat', 's3')).player.seat).toBe('pilot');
  });

  it('deletes the room when the last player leaves', () => {
    const rooms = new RoomManager();
    const { room } = unwrap(rooms.create('Ana', 's1'));
    expect(rooms.leave('s1')).toMatchObject({ closed: true });
    expect(rooms.get(room.code)).toBeUndefined();
    expect(rooms.size).toBe(0);
    expect(rooms.leave('s1')).toBeUndefined();
  });

  it('sweeps rooms that nobody is connected to after the idle time', () => {
    let now = 0;
    const rooms = new RoomManager({ now: () => now, idleTtlMs: 1000 });
    const idle = unwrap(rooms.create('Ana', 's1', 'a')).room;
    const busy = unwrap(rooms.create('Ben', 's2', 'b')).room;
    const recent = unwrap(rooms.create('Cat', 's3', 'c')).room;
    rooms.disconnect('s1');
    now = 900;
    rooms.disconnect('s3');
    rooms.touch(recent);

    now = 1000;
    expect(rooms.sweep()).toEqual([idle.code]);
    expect(rooms.get(idle.code)).toBeUndefined();
    // Still connected, even though idle: kept.
    expect(rooms.get(busy.code)).toBeDefined();
    // Nobody connected, but active 100 ms ago: kept until its own idle time passes.
    expect(rooms.get(recent.code)).toBeDefined();
    now = 1900;
    expect(rooms.sweep()).toEqual([recent.code]);
  });
});

/** The first active scenario that matches: tests don't depend on which ones scenarios.ts lists. */
function pick(match: (s: Scenario) => boolean): Scenario {
  const found = SCENARIO_LIST.find(match);
  if (!found) throw new Error('no active scenario matches this test');
  return found;
}

describe('setup choices', () => {
  const two = () => pick((s) => s.abilities === 2);
  const one = () => pick((s) => s.abilities === 1);
  const realTime = () => pick((s) => s.modules.includes('real-time'));
  const config = (scenario: Scenario, timerMs: number | null = null) =>
    game.configSchema.parse({ scenario: scenario.id, timerMs });

  /** A room on `scenario` with Ana (creator, pilot) and Ben (co-pilot) seated. */
  const seated = (scenario: Scenario) => {
    const rooms = new RoomManager();
    const { room, player: ana } = unwrap(rooms.create('Ana', 's1', 'ip', config(scenario)));
    const { player: ben } = unwrap(rooms.join(room.code, 'Ben', 's2'));
    return { rooms, room, ana, ben };
  };

  it('uses YUL when the lobby names no scenario, and refuses an unknown one', () => {
    expect(game.configSchema.parse({})).toMatchObject({ scenario: 'yul-green', timerMs: null });
    expect(game.configSchema.safeParse({ scenario: 'mars' }).success).toBe(false);
  });

  it('lets each player pick their own card when the scenario has two, never the same one', () => {
    const { rooms, room } = seated(two());
    unwrap(rooms.move(room, 'pilot', { type: 'pick-ability', ability: 'control' }));
    expect(rooms.move(room, 'copilot', { type: 'pick-ability', ability: 'control' })).toEqual({
      ok: false,
      error: 'ability-taken',
    });
    unwrap(rooms.move(room, 'copilot', { type: 'pick-ability', ability: 'mastery' }));
    expect(room.game.abilities).toEqual(['control', 'mastery']);
    expect(room.game.crew.picks).toEqual({ pilot: 'control', copilot: 'mastery' });
  });

  it('lets only the creator pick when the scenario has one card', () => {
    const { rooms, room } = seated(one());
    expect(rooms.move(room, 'copilot', { type: 'pick-ability', ability: 'control' })).toEqual({
      ok: false,
      error: 'not-your-pick',
    });
    unwrap(rooms.move(room, 'pilot', { type: 'pick-ability', ability: 'control' }));
    expect(room.game.abilities).toEqual(['control']);
  });

  it('cancels a confirm when a pick changes, and closes picking once round 1 starts', () => {
    const { rooms, room, ana } = seated(two());
    unwrap(rooms.chooseSeat(room, ana, 'pilot'));
    unwrap(rooms.move(room, 'pilot', { type: 'pick-ability', ability: 'control' }));
    unwrap(rooms.move(room, 'copilot', { type: 'pick-ability', ability: 'mastery' }));
    unwrap(rooms.move(room, 'copilot', { type: 'confirm' }));
    unwrap(rooms.move(room, 'pilot', { type: 'pick-ability', ability: 'adaptation' }));
    expect(room.game.crew.confirmed.copilot).toBe(false);
    unwrap(rooms.move(room, 'pilot', { type: 'confirm' }));
    unwrap(rooms.move(room, 'copilot', { type: 'confirm' }));
    expect(room.game.phase).toBe('strategy');
    expect(rooms.move(room, 'pilot', { type: 'pick-ability', ability: 'mastery' })).toEqual({
      ok: false,
      error: 'setup-closed',
    });
    expect(rooms.chooseSeat(room, ana, 'copilot')).toEqual({ ok: false, error: 'setup-closed' });
  });

  it('starts round 1, traffic die included, only once both have confirmed', () => {
    const traffic = pick((s) => (s.traffic?.[0] ?? 0) > 0 && s.abilities === 0);
    const { rooms, room, ana } = seated(traffic);
    expect(room.game.log).toEqual([]);
    expect(rooms.move(room, 'pilot', { type: 'confirm' })).toEqual({
      ok: false,
      error: 'roles-missing',
    });
    unwrap(rooms.chooseSeat(room, ana, 'pilot'));
    unwrap(rooms.move(room, 'pilot', { type: 'confirm' }));
    expect(room.game.phase).toBe('setup');
    unwrap(rooms.move(room, 'copilot', { type: 'confirm' }));
    expect(room.game.phase).toBe('strategy');
    expect(room.game.log.map((e) => e.type)).toEqual(['traffic']);
  });

  it('needs the partner at the table before confirming', () => {
    const rooms = new RoomManager();
    const { room, player: ana } = unwrap(rooms.create('Ana', 's1'));
    unwrap(rooms.chooseSeat(room, ana, 'pilot'));
    expect(rooms.move(room, 'pilot', { type: 'confirm' })).toEqual({
      ok: false,
      error: 'no-partner',
    });
  });

  it('lets only the creator choose the seats; the partner gets the other, picks going along', () => {
    const { rooms, room, ana, ben } = seated(two());
    unwrap(rooms.move(room, 'pilot', { type: 'pick-ability', ability: 'control' }));
    expect(rooms.chooseSeat(room, ben, 'pilot')).toEqual({ ok: false, error: 'not-creator' });
    expect(room.game.crew.rolesChosen).toBe(false);
    unwrap(rooms.chooseSeat(room, ana, 'copilot'));
    expect(room.players.pilot).toBe(ben);
    expect(room.players.copilot).toBe(ana);
    expect(ana.seat).toBe('copilot');
    expect(rooms.bySocket('s1')?.player).toBe(ana);
    expect(rooms.presence(room).copilot).toEqual({ name: 'Ana', online: true, creator: true });
    expect(room.game.crew).toMatchObject({
      host: 'copilot',
      rolesChosen: true,
      picks: { pilot: null, copilot: 'control' },
    });
  });

  it('keeps the picks for the next game, and makes the one who stays the creator', () => {
    const { rooms, room, ben } = seated(two());
    unwrap(rooms.move(room, 'pilot', { type: 'pick-ability', ability: 'control' }));
    unwrap(rooms.move(room, 'copilot', { type: 'pick-ability', ability: 'mastery' }));
    rooms.rematch(room);
    expect(room.game.abilities).toEqual(['control', 'mastery']);
    rooms.leave('s1');
    expect(ben.creator).toBe(true);
    expect(room.game.abilities).toEqual(['mastery']);
    expect(room.game.crew).toMatchObject({ host: 'copilot', rolesChosen: false });
  });

  it('keeps the lobby timer choice across rematches, even after a Real-time scenario', () => {
    const rooms = new RoomManager();
    const { room } = unwrap(rooms.create('Ana', 's1', 'ip', config(realTime())));
    expect(room.game.timerMs).toBe(60_000);
    rooms.rematch(room, { ...room.config, scenario: 'yul-green' });
    expect(room.game.timerMs).toBeNull();
  });
});

describe('scheduled moves', () => {
  afterEach(() => vi.useRealTimers());

  /** A YUL room with both seated and round 1 started, on fake timers and a fake clock. */
  function startedRoom(timerMs: number | null) {
    vi.useFakeTimers({ now: 1_000_000 });
    const rooms = new RoomManager({ seed: () => 1 });
    const changed: string[] = [];
    rooms.onScheduled = (room) => {
      changed.push(room.code);
      rooms.arm(room);
    };
    const { room, player } = unwrap(
      rooms.create('Ana', 's1', 'ip', game.configSchema.parse({ timerMs })),
    );
    unwrap(rooms.join(room.code, 'Ben', 's2'));
    unwrap(rooms.chooseSeat(room, player, 'pilot'));
    unwrap(rooms.move(room, 'pilot', { type: 'confirm' }));
    unwrap(rooms.move(room, 'copilot', { type: 'confirm' }));
    return { rooms, room, changed };
  }

  const roll = (rooms: RoomManager, room: Room) => {
    unwrap(rooms.move(room, 'pilot', { type: 'ready' }));
    unwrap(rooms.move(room, 'copilot', { type: 'ready' }));
  };

  it('ends a timed round when its time runs out, and never before', () => {
    const { rooms, room, changed } = startedRoom(10_000);
    roll(rooms, room);
    expect(room.game.deadline).toBe(1_000_000 + 10_000);
    rooms.arm(room);
    vi.advanceTimersByTime(9_999);
    expect(changed).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(changed).toEqual([room.code]);
    expect(room.game).toMatchObject({ phase: 'lost', endReason: 'time-up', deadline: null });
    expect(room.timer).toBeUndefined();
  });

  it('makes a due move before the next player move, at its own time', () => {
    const { rooms, room } = startedRoom(10_000);
    roll(rooms, room);
    // No timer armed (as if the server had been stopped): the next move finds the round over.
    vi.setSystemTime(1_000_000 + 60_000);
    expect(rooms.runDue(room)).toEqual([
      { move: { type: 'time-up' }, by: 'system', at: 1_000_000 + 10_000 },
    ]);
    expect(room.game.phase).toBe('lost');
  });

  it('rolls a Total Trust round by itself after the pause', () => {
    const { rooms, room, changed } = startedRoom(null);
    // The round's space says Total Trust: nobody talks or presses "Roll dice".
    room.game = { ...room.game, autoRoll: true, autoRollAt: Date.now() + 5_000 };
    rooms.arm(room);
    vi.advanceTimersByTime(4_999);
    expect(room.game.phase).toBe('strategy');
    vi.advanceTimersByTime(1);
    expect(changed).toEqual([room.code]);
    expect(room.game).toMatchObject({ phase: 'placing', autoRollAt: null });
  });

  it('fires nothing after close, and arms nothing more', () => {
    const { rooms, room, changed } = startedRoom(10_000);
    roll(rooms, room);
    rooms.arm(room);
    rooms.close();
    vi.advanceTimersByTime(20_000);
    expect(changed).toEqual([]);
    rooms.arm(room);
    expect(room.timer).toBeUndefined();
  });
});
