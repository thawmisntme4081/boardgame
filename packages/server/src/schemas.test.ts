import { describe, expect, it } from 'vitest';
import { createRoomSchema, joinRoomSchema, emptySchema, rejoinRoomSchema } from './schemas';

describe('payload schemas', () => {
  it('trims names and limits them to 1..20 characters', () => {
    expect(createRoomSchema.parse({ name: '  Ana ' })).toEqual({ name: 'Ana' });
    expect(createRoomSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(createRoomSchema.safeParse({ name: 'x'.repeat(21) }).success).toBe(false);
    expect(createRoomSchema.safeParse({ name: 42 }).success).toBe(false);
    expect(createRoomSchema.safeParse(null).success).toBe(false);
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

  it('accepts an empty or missing ready payload', () => {
    expect(emptySchema.safeParse({}).success).toBe(true);
    expect(emptySchema.safeParse(undefined).success).toBe(true);
    expect(emptySchema.safeParse('ready').success).toBe(false);
  });
});
