import { describe, expect, it } from 'vitest';
import { SCENARIO_LIST, type Scenario } from '@sky/shared';
import { resolveSetup, ROOM_CODE_ALPHABET, RoomManager } from './rooms';

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
    expect(player).toMatchObject({ seat: 'pilot', name: 'Ana', socketId: 's1', ready: false });
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
    expect(rooms.presence(room).pilot).toMatchObject({ name: 'Ana', online: false, ready: false });

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
    expect(rooms.presence(room)).toMatchObject({
      pilot: { name: 'Ana', online: true, ready: false },
      copilot: null,
    });
    expect(rooms.bothSeated(room)).toBe(false);
    unwrap(rooms.join(room.code, 'Ben', 's2'));
    expect(rooms.bothSeated(room)).toBe(true);
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
    room.players.copilot!.ready = true;
    room.game = { ...room.game, round: 3, log: [{ type: 'round-end', round: 2 }] };

    const left = rooms.leave('s1');
    expect(left).toMatchObject({ closed: false, player: { name: 'Ana', seat: 'pilot' } });
    expect(room.players.pilot).toBeUndefined();
    expect(rooms.bySocket('s1')).toBeUndefined();
    expect(room.game).toMatchObject({ round: 1, phase: 'setup', log: [], rngSeed: 101 });
    expect(room.players.copilot!.ready).toBe(false);
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

describe('resolveSetup', () => {
  const two = () => pick((s) => s.abilities === 2);
  const one = () => pick((s) => s.abilities === 1);
  const realTime = () => pick((s) => s.modules.includes('real-time'));

  it('defaults to YUL and needs a known scenario', () => {
    expect(resolveSetup({})).toMatchObject({ scenario: { id: 'yul-green' } });
    expect(resolveSetup({ scenario: two().id })).toMatchObject({ scenario: { id: two().id } });
    expect(resolveSetup({ scenario: 'mars' })).toBeUndefined();
  });

  /** A room on `scenario` with Ana (creator, pilot) and Ben (co-pilot) seated. */
  const seated = (scenario: Scenario) => {
    const rooms = new RoomManager();
    const { room, player: ana } = unwrap(
      rooms.create('Ana', 's1', 'ip', { setup: resolveSetup({ scenario: scenario.id })! }),
    );
    const { player: ben } = unwrap(rooms.join(room.code, 'Ben', 's2'));
    return { rooms, room, ana, ben };
  };

  it('lets each player pick their own card when the scenario has two, never the same one', () => {
    const { rooms, room, ana, ben } = seated(two());
    expect(rooms.abilitiesChosen(room)).toBe(false);
    unwrap(rooms.pickAbility(room, ana, 'control'));
    expect(rooms.pickAbility(room, ben, 'control')).toEqual({ ok: false, error: 'ability-taken' });
    unwrap(rooms.pickAbility(room, ben, 'mastery'));
    expect(room.game.abilities).toEqual(['control', 'mastery']);
    expect(rooms.abilitiesChosen(room)).toBe(true);
    expect(rooms.presence(room).copilot).toMatchObject({ pick: 'mastery', creator: false });
  });

  it('lets only the creator pick when the scenario has one card', () => {
    const { rooms, room, ana, ben } = seated(one());
    expect(rooms.pickAbility(room, ben, 'control')).toEqual({ ok: false, error: 'not-your-pick' });
    unwrap(rooms.pickAbility(room, ana, 'control'));
    expect(room.game.abilities).toEqual(['control']);
  });

  it('cancels a confirm when a pick changes, and closes picking once round 1 starts', () => {
    const { rooms, room, ana, ben } = seated(two());
    unwrap(rooms.chooseSeat(room, ana, 'pilot'));
    unwrap(rooms.pickAbility(room, ana, 'control'));
    unwrap(rooms.pickAbility(room, ben, 'mastery'));
    unwrap(rooms.confirm(room, ben));
    unwrap(rooms.pickAbility(room, ana, 'adaptation'));
    expect(ben.confirmed).toBe(false);
    unwrap(rooms.confirm(room, ana));
    unwrap(rooms.confirm(room, ben));
    expect(room.game.phase).toBe('strategy');
    expect(rooms.pickAbility(room, ana, 'mastery')).toEqual({ ok: false, error: 'setup-closed' });
  });

  it('starts round 1, traffic die included, only once both have confirmed', () => {
    const traffic = pick((s) => (s.traffic?.[0] ?? 0) > 0 && s.abilities === 0);
    const { rooms, room, ana, ben } = seated(traffic);
    expect(room.game.log).toEqual([]);
    expect(rooms.confirm(room, ana)).toEqual({ ok: false, error: 'roles-missing' });
    unwrap(rooms.chooseSeat(room, ana, 'pilot'));
    unwrap(rooms.confirm(room, ana));
    expect(room.game.phase).toBe('setup');
    unwrap(rooms.confirm(room, ben));
    expect(room.game.phase).toBe('strategy');
    expect(room.game.log.map((e) => e.type)).toEqual(['traffic']);
  });

  it('lets only the creator choose the seats; the partner gets the other, picks going along', () => {
    const { rooms, room, ana, ben } = seated(two());
    unwrap(rooms.pickAbility(room, ana, 'control'));
    expect(rooms.chooseSeat(room, ben, 'pilot')).toEqual({ ok: false, error: 'not-creator' });
    expect(rooms.presence(room).pilot).toMatchObject({ rolesChosen: false });
    unwrap(rooms.chooseSeat(room, ana, 'copilot'));
    expect(room.players.pilot).toBe(ben);
    expect(room.players.copilot).toBe(ana);
    expect(ana.seat).toBe('copilot');
    expect(rooms.bySocket('s1')?.player).toBe(ana);
    expect(rooms.presence(room).copilot).toMatchObject({
      name: 'Ana',
      creator: true,
      pick: 'control',
      rolesChosen: true,
    });
  });

  it('keeps the picks for the next game, and makes the one who stays the creator', () => {
    const { rooms, room, ana, ben } = seated(two());
    unwrap(rooms.pickAbility(room, ana, 'control'));
    unwrap(rooms.pickAbility(room, ben, 'mastery'));
    rooms.rematch(room);
    expect(room.game.abilities).toEqual(['control', 'mastery']);
    rooms.leave('s1');
    expect(ben.creator).toBe(true);
    expect(room.game.abilities).toEqual(['mastery']);
  });

  it('keeps the lobby timer choice across rematches, even after a Real-time scenario', () => {
    const rooms = new RoomManager();
    const { room } = unwrap(
      rooms.create('Ana', 's1', 'ip', { setup: resolveSetup({ scenario: realTime().id })! }),
    );
    expect(room.game.timerMs).toBe(60_000);
    rooms.rematch(room, resolveSetup({})!);
    expect(room.game.timerMs).toBeNull();
  });
});
