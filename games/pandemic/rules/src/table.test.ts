import { describe, expect, it } from 'vitest';
import { pandemic } from './definition';
import { checkJoin, openTable, seatJoined } from './table';
import { dealt } from './test-utils';
import type { PandemicState, SeatId } from './types';

const system = { by: 'system', at: 0 } as const;

/** A table for `players`, opened by p1 alone (as the platform creates a room). */
const opened = (players: number): PandemicState =>
  pandemic.setup({ config: { players, epidemics: 4 }, seats: ['p1'], host: 'p1', seed: 7 });

const join = (state: PandemicState, seat: SeatId): PandemicState =>
  pandemic.apply(state, { type: 'table:join', seat }, system);

describe('the table', () => {
  it('waits for the number of players chosen in the lobby', () => {
    const state = opened(3);
    expect(state).toEqual({ status: 'waiting', seated: ['p1'], players: 3, epidemics: 4, seed: 7 });
    expect(pandemic.started?.(state)).toBe(false);
    expect(pandemic.actors(state)).toEqual([]);
    expect(pandemic.outcome(state)).toBeNull();
  });

  it('deals the game when the last chosen seat is taken, never earlier', () => {
    let state = join(opened(3), 'p2');
    expect(state.status).toBe('waiting');
    state = join(state, 'p3');
    const game = dealt(state);
    expect([...game.seats].sort()).toEqual(['p1', 'p2', 'p3']);
    expect(game.status).toBe('playing');
    expect(pandemic.started?.(state)).toBe(true);
  });

  it('deals the same game as a table opened with everyone seated', () => {
    const joined = join(opened(2), 'p2');
    const direct = openTable({ seats: ['p1', 'p2'], players: 2, epidemics: 4, seed: 7 });
    expect(joined).toEqual(direct);
  });

  it('refuses a seat taken twice, or once the table is full', () => {
    const state = opened(2);
    expect(checkJoin(state, 'p1')).toEqual({ ok: false, reason: 'room-full' });
    const game = join(state, 'p2');
    expect(checkJoin(game, 'p3')).toEqual({ ok: false, reason: 'room-full' });
    expect(pandemic.validate(game, { type: 'table:join', seat: 'p3' }, system).ok).toBe(false);
  });

  it('lets someone take over a seat of the game, and nothing else changes', () => {
    const game = join(opened(2), 'p2');
    expect(checkJoin(game, 'p2')).toEqual({ ok: true });
    expect(seatJoined(game, 'p2')).toBe(game);
  });

  it('accepts a join only from the platform', () => {
    expect(
      pandemic.validate(opened(2), { type: 'table:join', seat: 'p2' }, { by: 'p1', at: 0 }).ok,
    ).toBe(false);
  });

  it('refuses every player move until the game is dealt', () => {
    expect(pandemic.validate(opened(3), { type: 'pass' }, { by: 'p1', at: 0 })).toEqual({
      ok: false,
      reason: 'not-started',
    });
  });

  it('shows who is seated while waiting, without the seed', () => {
    const view = pandemic.view(join(opened(4), 'p2'), 'p2', 0);
    expect(view).toEqual({
      status: 'waiting',
      you: 'p2',
      seated: ['p1', 'p2'],
      players: 4,
      epidemics: 4,
    });
    expect(JSON.stringify(view)).not.toContain('seed');
  });
});
