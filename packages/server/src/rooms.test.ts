import { describe, expect, it } from 'vitest';
import { ROOM_CODE_ALPHABET, RoomManager } from './rooms';

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
    expect(room.game.phase).toBe('strategy');
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
    expect(rooms.presence(room).pilot).toEqual({ name: 'Ana', online: false, ready: false });

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
    expect(room.game).toMatchObject({ round: 1, phase: 'strategy', log: [], rngSeed: 101 });
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
