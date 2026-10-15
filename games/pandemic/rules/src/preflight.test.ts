// Pandemic 06: the "before the game" step (turn order, roles dealt or picked, confirm), the
// lobby's difficulty and role mode, and the rematch that starts it again.
import { describe, expect, it } from 'vitest';
import { pandemic, pandemicConfigSchema, pandemicLobbySchema } from './definition';
import { applyPreflight, beginSetup, checkPreflight, type PreflightMove } from './preflight';
import { createGame } from './setup';
import { dealt } from './test-utils';
import { tableViewFor } from './views';
import {
  ROLE_IDS,
  type GameState,
  type PandemicState,
  type RoleMode,
  type SeatId,
  type SetupState,
} from './types';

const SEATS: SeatId[] = ['p1', 'p2', 'p3'];
const begin = (roleMode: RoleMode, seed = 5, seats: SeatId[] = SEATS): SetupState =>
  beginSetup({ seats, epidemics: 5, roleMode, seed });
const reason = (state: SetupState, seat: SeatId, move: PreflightMove) => {
  const check = checkPreflight(state, seat, move);
  return check.ok ? 'ok' : check.reason;
};
const apply = (state: SetupState, seat: SeatId, move: PreflightMove) =>
  applyPreflight(state, seat, move) as SetupState;

describe('the lobby choices', () => {
  it('offers the players, the difficulty (4, 5 or 6 epidemics) and the role mode', () => {
    expect(pandemicLobbySchema.safeParse({}).success).toBe(true);
    expect(
      pandemicLobbySchema.safeParse({ players: 4, epidemics: 6, roleMode: 'choose' }).success,
    ).toBe(true);
    for (const bad of [{ epidemics: 3 }, { epidemics: 7 }, { roleMode: 'draft' }, { players: 5 }]) {
      expect(pandemicLobbySchema.safeParse(bad).success).toBe(false);
    }
  });

  it('starts at introductory difficulty with the roles dealt at random', () => {
    expect(pandemicConfigSchema.parse({})).toEqual({
      players: 2,
      epidemics: 4,
      roleMode: 'random',
    });
  });
});

describe('the "before the game" step', () => {
  it('draws the turn order from the seed, whoever sat down first', () => {
    const a = begin('random', 9, ['p1', 'p2', 'p3']);
    const b = begin('random', 9, ['p3', 'p1', 'p2']);
    expect(a.seats).toEqual(b.seats);
    expect([...a.seats].sort()).toEqual(SEATS);
    // Different seeds give different orders (all 6 of 3 players turn up).
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) orders.add(begin('random', seed).seats.join());
    expect(orders.size).toBe(6);
  });

  it('deals each seat a different role at once in random mode, and none in choose mode', () => {
    const random = begin('random');
    const roles = SEATS.map((seat) => random.picks[seat]);
    expect(new Set(roles).size).toBe(3);
    expect(roles.every((role) => ROLE_IDS.includes(role!))).toBe(true);
    expect(begin('choose').picks).toEqual({});
    expect(random.confirmed).toEqual([]);
  });

  it('lets a player pick a role nobody has, and change it until confirming (choose mode)', () => {
    let state = begin('choose');
    state = apply(state, 'p1', { type: 'pick-role', role: 'medic' });
    expect(reason(state, 'p2', { type: 'pick-role', role: 'medic' })).toBe('role-taken');
    state = apply(state, 'p1', { type: 'pick-role', role: 'scientist' });
    expect(state.picks).toEqual({ p1: 'scientist' });
    // The role p1 gave up is free again.
    expect(reason(state, 'p2', { type: 'pick-role', role: 'medic' })).toBe('ok');
  });

  it('refuses picking in random mode, a role that does not exist and a seat not at the table', () => {
    expect(reason(begin('random'), 'p1', { type: 'pick-role', role: 'medic' })).toBe('roles-dealt');
    expect(reason(begin('choose'), 'p1', { type: 'pick-role', role: 'wizard' as never })).toBe(
      'wrong-role',
    );
    expect(reason(begin('choose', 5, ['p1', 'p2']), 'p3', { type: 'confirm' })).toBe('bad-seat');
  });

  it('needs a role to confirm, and locks the pick once confirmed', () => {
    let state = begin('choose');
    expect(reason(state, 'p1', { type: 'confirm' })).toBe('pick-first');
    state = apply(state, 'p1', { type: 'pick-role', role: 'medic' });
    state = apply(state, 'p1', { type: 'confirm' });
    expect(state.confirmed).toEqual(['p1']);
    expect(reason(state, 'p1', { type: 'pick-role', role: 'scientist' })).toBe('already-confirmed');
    expect(reason(state, 'p1', { type: 'confirm' })).toBe('already-confirmed');
  });

  it('takes a confirm back until the last player confirms', () => {
    let state = begin('random');
    expect(reason(state, 'p1', { type: 'unconfirm' })).toBe('not-confirmed');
    state = apply(state, 'p1', { type: 'confirm' });
    state = apply(state, 'p1', { type: 'unconfirm' });
    expect(state.confirmed).toEqual([]);
    // The pick is free again after an undo.
    expect(reason(begin('choose'), 'p1', { type: 'pick-role', role: 'medic' })).toBe('ok');
  });

  it('deals the board when the last player confirms, with that order and those roles', () => {
    let state = begin('choose', 3, ['p1', 'p2']);
    state = apply(state, 'p1', { type: 'pick-role', role: 'dispatcher' });
    state = apply(state, 'p2', { type: 'pick-role', role: 'researcher' });
    state = apply(state, 'p2', { type: 'confirm' });
    const done = applyPreflight(state, 'p1', { type: 'confirm' }) as GameState;
    expect(done.status).toBe('playing');
    expect(done.seats).toEqual(state.seats);
    expect(done.turn.seat).toBe(state.seats[0]);
    expect(done.roles).toEqual({ p1: 'dispatcher', p2: 'researcher' });
    expect(done.epidemics).toBe(5);
    expect(done.checkpoint).toBeNull();
    // The same board as createGame makes from those inputs.
    expect(done).toEqual(
      createGame({
        seats: state.seats,
        epidemics: 5,
        seed: 3,
        ordered: true,
        roles: { p1: 'dispatcher', p2: 'researcher' },
      }),
    );
  });

  it('shows everything of the step to everyone, and nothing of the board or the seed', () => {
    const state = begin('random', 5);
    for (const viewer of [...SEATS, 'spectator']) {
      const view = tableViewFor(state, viewer);
      expect(view).toMatchObject({ status: 'setup', epidemics: 5, roleMode: 'random' });
      expect(JSON.stringify(view)).not.toMatch(/seed|rngState|"playerDeck"|"infectionDeck"|hands/);
    }
    expect(tableViewFor(state, 'p2')).toMatchObject({ you: 'p2' });
    expect(tableViewFor(state, 'spectator')).toMatchObject({ you: null });
  });
});

describe('the definition around the step', () => {
  const config = { players: 3, epidemics: 6, roleMode: 'choose' } as const;
  const open = (seats: SeatId[], previous?: PandemicState) =>
    pandemic.setup({ config, seats, host: 'p1', seed: 4, ...(previous && { previous }) });

  it('starts the step when the last chosen seat is taken, with the lobby choices', () => {
    expect(open(['p1', 'p2']).status).toBe('waiting');
    expect(open(SEATS)).toMatchObject({ status: 'setup', epidemics: 6, roleMode: 'choose' });
  });

  it('counts the step as part of the match, with every unconfirmed seat to act', () => {
    const state = apply(open(SEATS) as SetupState, 'p1', { type: 'pick-role', role: 'medic' });
    expect(pandemic.started?.(state)).toBe(true);
    expect(pandemic.outcome(state)).toBeNull();
    const confirmed = apply(apply(state, 'p1', { type: 'confirm' }), 'p2', {
      type: 'pick-role',
      role: 'scientist',
    });
    expect(pandemic.actors(confirmed)).toEqual(
      confirmed.seats.map((seat) => ({
        seat,
        kind: 'simultaneous',
        committed: confirmed.confirmed.includes(seat),
      })),
    );
  });

  it("accepts the step's moves from a seated player, and no game move until it is over", () => {
    const state = open(SEATS) as SetupState;
    const by = state.seats[0] as string;
    const ctx = { by, at: 0 };
    expect(pandemic.validate(state, { type: 'pick-role', role: 'medic' }, ctx)).toEqual({
      ok: true,
    });
    expect(pandemic.validate(state, { type: 'pass' }, ctx)).toEqual({
      ok: false,
      reason: 'not-started',
    });
    expect(pandemic.validate(state, { type: 'confirm' }, { by: 'p4', at: 0 })).toEqual({
      ok: false,
      reason: 'not-seated',
    });
    expect(pandemic.validate(state, { type: 'confirm' }, { by: 'system', at: 0 })).toEqual({
      ok: false,
      reason: 'not-allowed',
    });
    expect(
      pandemic.moveSchema.safeParse({ type: 'pick-role', role: 'medic' }).success &&
        pandemic.moveSchema.safeParse({ type: 'unconfirm' }).success &&
        !pandemic.moveSchema.safeParse({ type: 'pick-role', role: 'wizard' }).success,
    ).toBe(true);
  });

  it('plays a rematch with the same difficulty and role mode, a new order, and fresh choices', () => {
    const first = dealt(pandemic.setup({ config, seats: SEATS, host: 'p1', seed: 4 }));
    // After a game: the same players, seed changed.
    const again = pandemic.setup({ config, seats: SEATS, host: 'p1', seed: 99, previous: first });
    expect(again).toMatchObject({ status: 'setup', epidemics: 6, roleMode: 'choose', picks: {} });
    // Someone left: the players still seated play it.
    const fewer = pandemic.setup({
      config,
      seats: ['p1', 'p3'],
      host: 'p1',
      seed: 99,
      previous: first,
    });
    expect(fewer).toMatchObject({ status: 'setup', seats: expect.arrayContaining(['p1', 'p3']) });
    expect((fewer as SetupState).seats).toHaveLength(2);
    // Different seeds give different turn orders somewhere.
    const orders = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      orders.add(
        (
          pandemic.setup({ config, seats: SEATS, host: 'p1', seed, previous: first }) as SetupState
        ).seats.join(),
      );
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('deals random roles again in a random-mode rematch', () => {
    const randomConfig = { players: 3, epidemics: 4, roleMode: 'random' } as const;
    const first = dealt(
      pandemic.setup({ config: randomConfig, seats: SEATS, host: 'p1', seed: 1 }),
    );
    const again = pandemic.setup({
      config: randomConfig,
      seats: SEATS,
      host: 'p1',
      seed: 2,
      previous: first,
    }) as SetupState;
    expect(Object.keys(again.picks)).toHaveLength(3);
    expect(again.confirmed).toEqual([]);
  });
});
