import { describe, expect, it } from 'vitest';
import {
  chooseSeatSchema,
  createRoomSchema,
  emptySchema,
  joinRoomSchema,
  moveSchema,
  rejoinRoomSchema,
  rematchSchema,
} from './index';

describe('payload schemas', () => {
  it('trims names, limits them to 1..20 characters, and needs the game', () => {
    expect(createRoomSchema.parse({ name: '  Ana ', game: 'sky-team' })).toEqual({
      name: 'Ana',
      game: 'sky-team',
    });
    expect(createRoomSchema.safeParse({ name: '   ', game: 'sky-team' }).success).toBe(false);
    expect(createRoomSchema.safeParse({ name: 'x'.repeat(21), game: 'g' }).success).toBe(false);
    expect(createRoomSchema.safeParse({ name: 42, game: 'g' }).success).toBe(false);
    expect(createRoomSchema.safeParse({ name: 'Ana' }).success).toBe(false);
    expect(createRoomSchema.safeParse(null).success).toBe(false);
  });

  it('passes the lobby config through untouched, for the game to check', () => {
    const config = { scenario: 'yul-green', timer: true };
    expect(createRoomSchema.parse({ name: 'Ana', game: 'sky-team', config })).toMatchObject({
      config,
    });
  });

  it('uppercases 4-letter room codes and rejects anything else', () => {
    expect(joinRoomSchema.parse({ code: 'abcd', name: 'Ben' })).toEqual({
      code: 'ABCD',
      name: 'Ben',
    });
    for (const code of ['ABC', 'ABCDE', 'AB1D', '', 'AB D']) {
      expect(joinRoomSchema.safeParse({ code, name: 'Ben' }).success).toBe(false);
    }
  });

  it('requires a UUID token to rejoin', () => {
    const token = '0f8fad5b-d9cb-469f-a165-70867728950e';
    expect(rejoinRoomSchema.parse({ code: 'wxyz', token })).toEqual({ code: 'WXYZ', token });
    expect(rejoinRoomSchema.safeParse({ code: 'WXYZ', token: 'abc' }).success).toBe(false);
  });

  it('accepts an empty or missing payload for events without data', () => {
    expect(emptySchema.safeParse({}).success).toBe(true);
    expect(emptySchema.safeParse(undefined).success).toBe(true);
    expect(emptySchema.safeParse('ready').success).toBe(false);
  });

  it('needs a match id and a positive whole seq on every move', () => {
    const move = { type: 'ready' };
    expect(moveSchema.safeParse({ matchId: 'ABCD-1', seq: 1, move }).success).toBe(true);
    for (const seq of [0, -1, 1.5, '1']) {
      expect(moveSchema.safeParse({ matchId: 'ABCD-1', seq, move }).success).toBe(false);
    }
    expect(moveSchema.safeParse({ seq: 1, move }).success).toBe(false);
  });

  it('names the match a rematch answers, and a seat to choose', () => {
    expect(rematchSchema.safeParse({ matchId: 'ABCD-1' }).success).toBe(true);
    expect(rematchSchema.safeParse({}).success).toBe(false);
    expect(chooseSeatSchema.safeParse({ seat: 'copilot' }).success).toBe(true);
    expect(chooseSeatSchema.safeParse({ seat: '' }).success).toBe(false);
  });
});
