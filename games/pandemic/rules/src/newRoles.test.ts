// The Relocation Specialist, the Crisis Mitigator and the Generalist (fan-made roles): the
// actions a turn starts with, and taking cubes and a pawn along when a pawn leaves a city.
import { checkGame } from '@platform/engine/testing';
import { describe, expect, it } from 'vitest';
import { actionsPerTurn, cubesOnBoard } from './actions';
import { pandemic } from './definition';
import { applyMoveOffer, canCarryOnAccept, checkMoveOffer, type MoveOfferMove } from './moveOffer';
import { applyMove, checkMove, type PandemicMove } from './moves';
import { agentMove } from './random-play';
import { createGame } from './setup';
import { addCubes, blankGame, city, give } from './test-utils';
import { COLORS } from './cities';
import { CUBES_PER_COLOR, SEATS, type GameState, type SeatId } from './types';

const why = (game: GameState, seat: SeatId, move: PandemicMove): string => {
  const check = checkMove(game, seat, move);
  return check.ok ? 'ok' : check.reason;
};

/** A 3-player game, p1 the Relocation Specialist in Atlanta with 3 blue cubes and p2's pawn there. */
function relocation(): GameState {
  const game = blankGame(3);
  game.roles.p1 = 'relocation-specialist';
  addCubes(game, 'atlanta', 'blue', 3);
  return game;
}

/** Every cube is on the map or in the supply. */
const conserved = (game: GameState): boolean =>
  COLORS.every((color) => cubesOnBoard(game, color) + game.supply[color] === CUBES_PER_COLOR);

describe('the Generalist', () => {
  it('starts every turn with 5 actions, the first one included', () => {
    const game = createGame({
      seats: ['p1', 'p2'],
      epidemics: 4,
      seed: 1,
      roles: { p1: 'generalist', p2: 'generalist' },
    });
    expect(game.turn.actionsLeft).toBe(5);

    // The next player's turn, after the infect step of the one before.
    const next = blankGame(3);
    next.roles.p2 = 'generalist';
    next.turn = { ...next.turn, step: 'infect', infectionsLeft: 1 };
    next.infectionDeck = ['paris', 'london'];
    const after = applyMove(next, 'p1', { type: 'infect' });
    expect(after.turn).toMatchObject({ seat: 'p2', actionsLeft: 5 });
    // Other roles keep 4.
    expect(actionsPerTurn(next, 'p1')).toBe(4);
  });
});

describe('the Crisis Mitigator', () => {
  const cubes: [number, number][] = [
    [0, 4],
    [1, 4],
    [2, 5],
    [3, 6],
    [4, 7],
    [6, 7],
  ];

  it.each(cubes)('with %i cube(s) in its city has %i actions', (count, actions) => {
    const game = blankGame(2);
    game.roles.p1 = 'crisis-mitigator';
    // Spread over the colors: no color holds more than 3.
    for (let i = 0; i < count; i++) addCubes(game, 'atlanta', COLORS[i % 4]!, 1);
    expect(actionsPerTurn(game, 'p1')).toBe(actions);
  });

  it('counts the cubes of every color when its turn starts, the first turn included', () => {
    const game = createGame({
      seats: ['p1', 'p2'],
      epidemics: 4,
      seed: 3,
      roles: { p1: 'crisis-mitigator', p2: 'crisis-mitigator' },
    });
    const first = game.turn.seat;
    // Counted in Atlanta once the cities are infected: 4 to 7, never the plain 4 by default.
    expect(game.turn.actionsLeft).toBe(actionsPerTurn(game, first));
    expect(game.turn.actionsLeft).toBeGreaterThanOrEqual(4);

    const next = blankGame(3);
    next.roles.p2 = 'crisis-mitigator';
    next.pawns.p2 = 'tokyo';
    addCubes(next, 'tokyo', 'red', 2);
    addCubes(next, 'tokyo', 'blue', 1);
    next.turn = { ...next.turn, step: 'infect', infectionsLeft: 1 };
    next.infectionDeck = ['paris', 'london'];
    // Counted after the infection of the turn before, and fixed for the turn.
    const after = applyMove(next, 'p1', { type: 'infect' });
    expect(after.turn).toMatchObject({ seat: 'p2', actionsLeft: 6 });
    const treated = applyMove(after, 'p2', { type: 'treat', color: 'red' });
    expect(treated.turn.actionsLeft).toBe(5);
  });
});

describe('the Relocation Specialist taking cubes along', () => {
  it('moves the chosen cubes with the pawn, spends one action and keeps the cubes whole', () => {
    const game = relocation();
    const next = applyMove(game, 'p1', {
      type: 'drive',
      to: 'chicago',
      carry: { cubes: ['blue', 'blue'] },
    });
    expect(next.pawns.p1).toBe('chicago');
    expect(next.cubes.chicago.blue).toBe(2);
    expect(next.cubes.atlanta.blue).toBe(1);
    expect(next.turn.actionsLeft).toBe(3);
    expect(conserved(next)).toBe(true);
    // The log says where the cubes went.
    expect(next.log.current.entries).toContainEqual({
      type: 'carried',
      city: 'chicago',
      color: 'blue',
      cubes: 2,
      prevented: false,
      outbreaks: [],
    });
  });

  it('takes cubes of several colors, along any way the pawn leaves', () => {
    const game = relocation();
    addCubes(game, 'atlanta', 'red', 1);
    give(game, 'p1', city('tokyo'));
    const next = applyMove(game, 'p1', {
      type: 'direct',
      to: 'tokyo',
      carry: { cubes: ['blue', 'red', 'blue'] },
    });
    expect(next.cubes.tokyo).toMatchObject({ blue: 2, red: 1 });
    expect(next.hands.p1).toEqual([]);
    expect(conserved(next)).toBe(true);
  });

  it('takes nothing when it chooses nothing', () => {
    const game = relocation();
    const next = applyMove(game, 'p1', { type: 'drive', to: 'chicago', carry: { cubes: [] } });
    expect(next.cubes.atlanta.blue).toBe(3);
    expect(next.log.current.entries).toEqual([]);
  });

  it('refuses more than 3 cubes, cubes that are not there, and another role', () => {
    const game = relocation();
    addCubes(game, 'atlanta', 'red', 1);
    const drive = (cubes: ('blue' | 'red' | 'yellow')[]): PandemicMove => ({
      type: 'drive',
      to: 'chicago',
      carry: { cubes },
    });
    expect(why(game, 'p1', drive(['blue', 'blue', 'blue', 'red']))).toBe('too-many-cubes');
    expect(why(game, 'p1', drive(['yellow']))).toBe('no-cubes');
    expect(why(game, 'p1', drive(['red', 'red']))).toBe('no-cubes');
    expect(why(game, 'p1', drive(['blue', 'blue', 'blue']))).toBe('ok');
    game.roles.p1 = 'medic';
    expect(why(game, 'p1', drive(['blue']))).toBe('wrong-role');
  });

  it('outbreaks in the city when there was not room, and the extra cubes go back to the supply', () => {
    const game = relocation();
    addCubes(game, 'chicago', 'blue', 2);
    const next = applyMove(game, 'p1', {
      type: 'drive',
      to: 'chicago',
      carry: { cubes: ['blue', 'blue', 'blue'] },
    });
    expect(next.cubes.chicago.blue).toBe(3);
    expect(next.outbreaks).toBe(1);
    // Every neighbor of Chicago got one (Atlanta too, which the cubes had just left).
    expect(next.cubes.montreal.blue).toBe(1);
    expect(next.cubes.atlanta.blue).toBe(1);
    expect(conserved(next)).toBe(true);
    expect(next.log.current.entries[0]).toMatchObject({
      type: 'carried',
      city: 'chicago',
      outbreaks: ['chicago'],
    });
  });

  it('puts nothing where a role protects the city: the cubes go back to the supply', () => {
    const game = relocation();
    game.roles.p2 = 'quarantine-specialist';
    game.pawns.p2 = 'chicago';
    const next = applyMove(game, 'p1', {
      type: 'drive',
      to: 'chicago',
      carry: { cubes: ['blue', 'blue'] },
    });
    expect(next.cubes.chicago.blue).toBe(0);
    expect(next.cubes.atlanta.blue).toBe(1);
    expect(next.supply.blue).toBe(CUBES_PER_COLOR - 1);
    expect(conserved(next)).toBe(true);
    expect(next.log.current.entries[0]).toMatchObject({
      type: 'carried',
      cubes: 0,
      prevented: true,
    });
  });

  it('can eradicate a cured disease by taking its last cubes to a protected city', () => {
    const game = relocation();
    game.cures.blue = 'cured';
    game.roles.p2 = 'quarantine-specialist';
    game.pawns.p2 = 'chicago';
    const next = applyMove(game, 'p1', {
      type: 'drive',
      to: 'chicago',
      carry: { cubes: ['blue', 'blue', 'blue'] },
    });
    expect(next.cures.blue).toBe('eradicated');
  });
});

describe('the Relocation Specialist taking a pawn along', () => {
  const along = (pawn: 'p2' | 'p3' | 'p2-s1'): PandemicMove => ({
    type: 'drive',
    to: 'chicago',
    carry: { cubes: ['blue'], pawn },
  });

  it('asks the pawn’s owner first: nothing moves, and no action is spent, until it accepts', () => {
    const game = relocation();
    const offered = applyMove(game, 'p1', along('p2'));
    expect(offered.pending).toMatchObject({ kind: 'move', by: 'p1', pawn: 'p2' });
    expect(offered.pawns).toEqual(game.pawns);
    expect(offered.turn.actionsLeft).toBe(4);
    expect(why(offered, 'p1', { type: 'pass' })).toBe('answer-first');

    // Only the owner answers; the mover may cancel.
    expect(checkMoveOffer(offered, 'p3', { type: 'move-accept' })).toMatchObject({
      reason: 'not-your-answer',
    });
    expect(canCarryOnAccept(offered)).toBe(false);
    const done = applyMoveOffer(offered, 'p2', { type: 'move-accept' });
    expect(done.pawns).toMatchObject({ p1: 'chicago', p2: 'chicago', p3: 'atlanta' });
    expect(done.cubes.chicago.blue).toBe(1);
    expect(done.turn.actionsLeft).toBe(3);
    expect(done.pending).toBeNull();
    expect(conserved(done)).toBe(true);
  });

  it('is called off when the owner declines or the mover cancels', () => {
    const offered = applyMove(relocation(), 'p1', along('p2'));
    for (const [seat, move] of [
      ['p2', { type: 'move-decline' }],
      ['p1', { type: 'move-cancel' }],
    ] as const) {
      const off = applyMoveOffer(offered, seat, move);
      expect(off.pending).toBeNull();
      expect(off.pawns).toEqual(offered.pawns);
      expect(off.cubes.atlanta.blue).toBe(3);
      expect(off.turn.actionsLeft).toBe(4);
    }
  });

  it('works for a Teacher’s student, whose owner answers', () => {
    const game = relocation();
    game.roles.p2 = 'teacher';
    game.pawns['p2-s1'] = 'atlanta';
    const offered = applyMove(game, 'p1', along('p2-s1'));
    expect(offered.pending).toMatchObject({ pawn: 'p2-s1' });
    const done = applyMoveOffer(offered, 'p2', { type: 'move-accept' });
    expect(done.pawns).toMatchObject({ 'p2-s1': 'chicago', p2: 'atlanta' });
  });

  it('needs the pawn to be in the city it leaves, and not the pawn itself', () => {
    const game = relocation();
    game.pawns.p3 = 'miami';
    expect(why(game, 'p1', along('p3'))).toBe('not-together');
    expect(
      why(game, 'p1', { type: 'drive', to: 'chicago', carry: { cubes: [], pawn: 'p1' } }),
    ).toBe('not-together');
  });

  it('brings a Medic first, so it protects its cured color at once', () => {
    const game = relocation();
    game.roles.p2 = 'medic';
    game.cures.blue = 'cured';
    const offered = applyMove(game, 'p1', along('p2'));
    const done = applyMoveOffer(offered, 'p2', { type: 'move-accept' });
    // The cubes that came along are blocked where the Medic stands.
    expect(done.cubes.chicago.blue).toBe(0);
    expect(conserved(done)).toBe(true);
  });
});

describe('the Relocation Specialist moved by someone else', () => {
  /** p1 the Dispatcher moves p2, the Relocation Specialist, from Atlanta to Chicago. */
  function dispatched(): GameState {
    const game = blankGame(3);
    game.roles.p1 = 'dispatcher';
    game.roles.p2 = 'relocation-specialist';
    addCubes(game, 'atlanta', 'red', 2);
    return applyMove(game, 'p1', { type: 'drive', to: 'chicago', pawn: 'p2' });
  }

  it('chooses what comes along when accepting', () => {
    const offered = dispatched();
    expect(canCarryOnAccept(offered)).toBe(true);
    const accept: MoveOfferMove = { type: 'move-accept', carry: { cubes: ['red', 'red'] } };
    const done = applyMoveOffer(offered, 'p2', accept);
    expect(done.pawns.p2).toBe('chicago');
    expect(done.cubes.chicago.red).toBe(2);
    expect(done.cubes.atlanta.red).toBe(0);
    expect(done.turn.actionsLeft).toBe(3);
    expect(conserved(done)).toBe(true);
  });

  it('may also choose nothing, and only its owner may choose', () => {
    const offered = dispatched();
    expect(applyMoveOffer(offered, 'p2', { type: 'move-accept' }).cubes.atlanta.red).toBe(2);
    expect(checkMoveOffer(offered, 'p1', { type: 'move-cancel' }).ok).toBe(true);
    const many: MoveOfferMove = {
      type: 'move-accept',
      carry: { cubes: ['red', 'red', 'red', 'red'] },
    };
    expect(checkMoveOffer(offered, 'p2', many)).toMatchObject({ reason: 'too-many-cubes' });
    const missing: MoveOfferMove = { type: 'move-accept', carry: { cubes: ['red', 'red', 'red'] } };
    expect(checkMoveOffer(offered, 'p2', missing)).toMatchObject({ reason: 'no-cubes' });
    const other: MoveOfferMove = { type: 'move-accept', carry: { cubes: ['red'] } };
    expect(checkMoveOffer(offered, 'p1', other)).toMatchObject({ reason: 'not-your-answer' });
  });

  it('asks the owner of a pawn it takes along next, and spends the action once', () => {
    const offered = dispatched();
    const accept: MoveOfferMove = {
      type: 'move-accept',
      carry: { cubes: ['red'], pawn: 'p3' },
    };
    const second = applyMoveOffer(offered, 'p2', accept);
    // Nothing moved yet: p3 agrees first.
    expect(second.pending).toMatchObject({ kind: 'move', pawn: 'p3' });
    expect(second.pawns.p2).toBe('atlanta');
    expect(second.turn.actionsLeft).toBe(4);
    expect(canCarryOnAccept(second)).toBe(false);

    const done = applyMoveOffer(second, 'p3', { type: 'move-accept' });
    expect(done.pawns).toMatchObject({ p2: 'chicago', p3: 'chicago' });
    expect(done.cubes.chicago.red).toBe(1);
    expect(done.turn.actionsLeft).toBe(3);

    // If p3 declines, the whole move is called off.
    const off = applyMoveOffer(second, 'p3', { type: 'move-decline' });
    expect(off.pawns.p2).toBe('atlanta');
    expect(off.turn.actionsLeft).toBe(4);
  });

  it('is not offered to another role, nor to the Dispatcher’s own pawn', () => {
    const game = blankGame(3);
    game.roles.p1 = 'dispatcher';
    addCubes(game, 'atlanta', 'red', 1);
    expect(why(game, 'p1', { type: 'drive', to: 'chicago', carry: { cubes: ['red'] } })).toBe(
      'wrong-role',
    );
    // Another player's pawn: its owner chooses, not the mover.
    expect(
      why(game, 'p1', { type: 'drive', to: 'chicago', pawn: 'p2', carry: { cubes: ['red'] } }),
    ).toBe('wrong-role');
  });
});

describe('Airlift with the Relocation Specialist', () => {
  it('takes cubes along when played on its own pawn', () => {
    const game = relocation();
    game.hands.p1 = [{ kind: 'event', event: 'airlift' }];
    const next = applyMove(game, 'p1', {
      type: 'play-event',
      event: 'airlift',
      pawn: 'p1',
      to: 'tokyo',
      carry: { cubes: ['blue', 'blue'] },
    });
    expect(next.pawns.p1).toBe('tokyo');
    expect(next.cubes.tokyo.blue).toBe(2);
    expect(next.turn.actionsLeft).toBe(4);
    expect(conserved(next)).toBe(true);
  });

  it('lets the Relocation Specialist choose when another player airlifts it', () => {
    const game = relocation();
    game.hands.p2 = [{ kind: 'event', event: 'airlift' }];
    const offered = applyMove(game, 'p2', {
      type: 'play-event',
      event: 'airlift',
      pawn: 'p1',
      to: 'tokyo',
    });
    expect(canCarryOnAccept(offered)).toBe(true);
    const done = applyMoveOffer(offered, 'p1', {
      type: 'move-accept',
      carry: { cubes: ['blue'], pawn: 'p2' },
    });
    // p2 played the card and is the pawn taken along: it agrees (it is the mover's own pawn).
    expect(done.pawns.p1).toBe('atlanta');
    expect(done.pending).toMatchObject({ pawn: 'p2' });
    const finished = applyMoveOffer(done, 'p2', { type: 'move-accept' });
    expect(finished.pawns).toMatchObject({ p1: 'tokyo', p2: 'tokyo' });
    expect(finished.cubes.tokyo.blue).toBe(1);
    expect(finished.hands.p2).toEqual([]);
    expect(finished.turn.actionsLeft).toBe(4);
  });

  it('refuses a carry on another role’s pawn', () => {
    const game = relocation();
    game.hands.p2 = [{ kind: 'event', event: 'airlift' }];
    expect(
      why(game, 'p2', {
        type: 'play-event',
        event: 'airlift',
        pawn: 'p2',
        to: 'tokyo',
        carry: { cubes: [] },
      }),
    ).toBe('wrong-role');
  });
});

describe('the move schema', () => {
  const ok = (move: unknown) => pandemic.moveSchema.safeParse(move).success;

  it('knows what a pawn takes along, at most 3 cubes', () => {
    expect(
      ok({ type: 'drive', to: 'chicago', carry: { cubes: ['blue', 'red'], pawn: 'p2' } }),
    ).toBe(true);
    expect(ok({ type: 'move-accept', carry: { cubes: [] } })).toBe(true);
    expect(
      ok({ type: 'play-event', event: 'airlift', pawn: 'p1', to: 'paris', carry: { cubes: [] } }),
    ).toBe(true);
    expect(
      ok({ type: 'drive', to: 'chicago', carry: { cubes: ['blue', 'blue', 'blue', 'blue'] } }),
    ).toBe(false);
    expect(ok({ type: 'drive', to: 'chicago', carry: { cubes: ['green'] } })).toBe(false);
    expect(ok({ type: 'drive', to: 'chicago', carry: { cubes: [], pawn: 'p9' } })).toBe(false);
  });
});

describe('random games with the new roles', () => {
  it('play and replay through the engine kit, taking cubes and pawns along on the way', () => {
    let carried = 0;
    for (let seed = 1; seed <= 16; seed++) {
      const players = 2 + (seed % 3);
      const { final, moves } = checkGame({
        definition: pandemic,
        config: { players, epidemics: 4, roleMode: 'choose' },
        seats: SEATS.slice(0, players),
        seed,
        // p1 takes the Relocation Specialist first, and takes it back if the agent switched its pick.
        nextMove: (state, random) => {
          if (state.status === 'setup' && state.picks.p1 !== 'relocation-specialist') {
            if (!state.confirmed.includes('p1')) {
              return {
                by: 'p1',
                move: { type: 'pick-role', role: 'relocation-specialist' } as const,
              };
            }
          }
          return agentMove(state, random);
        },
        maxSteps: 3000,
      });
      expect((final as GameState).roles.p1).toBe('relocation-specialist');
      for (const { move } of moves) {
        const m = move as PandemicMove;
        if ('carry' in m && m.carry && m.type !== 'move-accept') carried += 1;
      }
    }
    expect(carried).toBeGreaterThan(0);
  });

  it('play and replay with the Crisis Mitigator and the Generalist', () => {
    for (const role of ['crisis-mitigator', 'generalist'] as const) {
      for (let seed = 1; seed <= 6; seed++) {
        const { final } = checkGame({
          definition: pandemic,
          config: { players: 3, epidemics: 4, roleMode: 'choose' },
          seats: SEATS.slice(0, 3),
          seed,
          nextMove: (state, random) => {
            if (
              state.status === 'setup' &&
              state.picks.p1 !== role &&
              !state.confirmed.includes('p1')
            ) {
              return { by: 'p1', move: { type: 'pick-role', role } as const };
            }
            return agentMove(state, random);
          },
          maxSteps: 3000,
        });
        expect((final as GameState).roles.p1).toBe(role);
      }
    }
  });
});
