import { describe, expect, it } from 'vitest';
import { assertPlainData } from './testing';

describe('assertPlainData', () => {
  it('accepts JSON data, with undefined object fields left out as JSON does', () => {
    expect(() =>
      assertPlainData({ a: 1, b: 'x', c: [true, null, { d: [] }], e: undefined }),
    ).not.toThrow();
  });

  it.each([
    ['a Map', { m: new Map() }, '$.m: Map'],
    ['a Set', [new Set()], '$[0]: Set'],
    ['a Date', { at: new Date(0) }, '$.at: Date'],
    ['a function', { f: () => 1 }, '$.f: a function'],
    ['NaN', { n: Number.NaN }, '$.n: NaN'],
    ['Infinity', [Infinity], '$[0]: Infinity'],
    ['undefined in an array', [1, undefined], '$[1]: undefined'],
  ])('rejects %s, naming where it is', (_what, value, message) => {
    expect(() => assertPlainData(value)).toThrow(message);
  });
});
