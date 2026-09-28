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
    for (let i = 0; i < 500; i++) codes.add(unwrap(rooms.create('P', `s${i}`)).room.code);
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
    const rooms = new RoomManager(() => now);
    const { room } = unwrap(rooms.create('Ana', 's1'));
    expect(room.createdAt).toBe(1000);
    now = 5000;
    unwrap(rooms.join(room.code, 'Ben', 's2'));
    expect(room.lastActivity).toBe(5000);
  });
});
