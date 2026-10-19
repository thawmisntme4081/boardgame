// The Z-Force Team Member (a Gen Con 2016 promo role): starting in Montreal, the move to Montreal or
// Essen, and the helped cure that other players in its city agree to.
import { checkGame } from '@platform/engine/testing';
import { describe, expect, it } from 'vitest';
import { checkCure, checkCureOffer, applyCureOffer } from './cure';
import { pandemic } from './definition';
import { legalRoleActions } from './legal';
import { applyMove, checkMove, type PandemicMove } from './moves';
import { agentMove } from './random-play';
import { createGame } from './setup';
import { addCubes, blankGame, city } from './test-utils';
import { SEATS, type GameState, type HandCard, type SeatId } from './types';

const why = (game: GameState, seat: SeatId, move: PandemicMove): string => {
  const check = checkMove(game, seat, move);
  return check.ok ? 'ok' : check.reason;
};
const cities = (...ids: Parameters<typeof city>[0][]): HandCard[] => ids.map(city);

/**
 * p1 the Z-Force Team Member at Atlanta's station with 3 blue cards, p2 there with 2, p3 away in
 * Miami with 1.
 */
function helped(): GameState {
  const game = blankGame(3);
  game.roles.p1 = 'z-force-team-member';
  game.stations = ['atlanta'];
  game.pawns.p3 = 'miami';
  game.hands.p1 = cities('chicago', 'montreal', 'new-york');
  game.hands.p2 = cities('london', 'madrid');
  game.hands.p3 = cities('paris');
  // A blue cube somewhere, so a new cure is not at once an eradication.
  addCubes(game, 'tokyo', 'blue', 1);
  return game;
}
const cure = (
  help: { seat: SeatId; city: Parameters<typeof city>[0] }[],
  cards: Parameters<typeof city>[0][] = ['chicago', 'montreal', 'new-york'],
): PandemicMove => ({ type: 'cure', color: 'blue', cards, help });
const both = [
  { seat: 'p2', city: 'london' },
  { seat: 'p2', city: 'madrid' },
] as const;

describe('starting in Montreal', () => {
  it('puts the Z-Force pawn in Montreal and the others in Atlanta', () => {
    const game = createGame({
      seats: ['p1', 'p2', 'p3'],
      epidemics: 4,
      seed: 1,
      roles: { p1: 'z-force-team-member', p2: 'medic', p3: 'scientist' },
    });
    expect(game.pawns).toEqual({ p1: 'montreal', p2: 'atlanta', p3: 'atlanta' });
    expect(game.stations).toEqual(['atlanta']);
  });
});

describe('Montreal or Essen', () => {
  it('moves to either from anywhere with no card, for one action, as often as wanted', () => {
    let game = blankGame(2);
    game.roles.p1 = 'z-force-team-member';
    game.pawns.p1 = 'tokyo';
    game = applyMove(game, 'p1', { type: 'montreal-essen', to: 'essen' });
    expect(game.pawns.p1).toBe('essen');
    expect(game.turn.actionsLeft).toBe(3);
    game = applyMove(game, 'p1', { type: 'montreal-essen', to: 'montreal' });
    game = applyMove(game, 'p1', { type: 'montreal-essen', to: 'essen' });
    expect(game.pawns.p1).toBe('essen');
    expect(game.turn.actionsLeft).toBe(1);
  });

  it('refuses the city it is in, any other city, other roles and an action it does not have', () => {
    const game = blankGame(2);
    game.roles.p1 = 'z-force-team-member';
    game.pawns.p1 = 'essen';
    expect(why(game, 'p1', { type: 'montreal-essen', to: 'essen' })).toBe('same-city');
    expect(why(game, 'p1', { type: 'montreal-essen', to: 'paris' })).toBe('wrong-role');
    expect(why(game, 'p1', { type: 'montreal-essen', to: 'montreal' })).toBe('ok');
    game.roles.p1 = 'dispatcher';
    expect(why(game, 'p1', { type: 'montreal-essen', to: 'montreal' })).toBe('wrong-role');
    game.roles.p1 = 'z-force-team-member';
    game.turn.actionsLeft = 0;
    expect(why(game, 'p1', { type: 'montreal-essen', to: 'montreal' })).toBe('no-actions-left');
  });

  it('is listed among the legal role actions, without the city it is in', () => {
    const game = blankGame(2);
    game.roles.p1 = 'z-force-team-member';
    game.pawns.p1 = 'montreal';
    expect(legalRoleActions(game, 'p1')).toContainEqual({ type: 'montreal-essen', to: 'essen' });
    expect(legalRoleActions(game, 'p1')).not.toContainEqual({
      type: 'montreal-essen',
      to: 'montreal',
    });
  });

  it('does not let the Dispatcher use it on the Z-Force pawn', () => {
    const game = blankGame(2);
    game.roles = { p1: 'dispatcher', p2: 'z-force-team-member' };
    game.pawns.p2 = 'tokyo';
    // The Dispatcher can still fly the pawn the usual way, but there is no such action for it.
    expect(why(game, 'p1', { type: 'montreal-essen', to: 'essen' })).toBe('wrong-role');
  });
});

describe('a cure with other players’ cards', () => {
  it('is an offer to the helper: nothing happens and no action is spent until it accepts', () => {
    const game = helped();
    const offered = applyMove(game, 'p1', cure([...both]));
    expect(offered.pending).toMatchObject({ kind: 'cure', by: 'p1', waiting: ['p2'] });
    expect(offered.cures.blue).toBe('none');
    expect(offered.turn.actionsLeft).toBe(4);
    expect(offered.hands.p2).toHaveLength(2);
    expect(why(offered, 'p1', { type: 'pass' })).toBe('answer-first');

    const done = applyCureOffer(offered, 'p2', { type: 'cure-accept' });
    expect(done.cures.blue).toBe('cured');
    expect(done.pending).toBeNull();
    expect(done.turn.actionsLeft).toBe(3);
    expect(done.hands.p1).toEqual([]);
    expect(done.hands.p2).toEqual([]);
    expect(done.playerDiscard).toHaveLength(5);
  });

  it('can use one card of a helper, or none: a plain cure needs no answer', () => {
    const four = helped();
    four.hands.p1 = cities('chicago', 'montreal', 'new-york', 'essen');
    // Four of its own plus one of the helper's is also 5 cards.
    const one = applyMove(
      four,
      'p1',
      cure([{ seat: 'p2', city: 'london' }], ['chicago', 'montreal', 'new-york', 'essen']),
    );
    expect(one.pending).toMatchObject({ kind: 'cure', waiting: ['p2'] });

    const game = helped();
    game.hands.p1 = cities('chicago', 'montreal', 'new-york', 'paris', 'essen');
    const plain = applyMove(game, 'p1', {
      type: 'cure',
      color: 'blue',
      cards: ['chicago', 'montreal', 'new-york', 'paris', 'essen'],
    });
    expect(plain.pending).toBeNull();
    expect(plain.cures.blue).toBe('cured');
  });

  it('asks every helper whose card is used, in any order', () => {
    const game = helped();
    game.pawns.p3 = 'atlanta';
    game.hands.p3 = cities('paris');
    const offered = applyMove(
      game,
      'p1',
      cure(
        [
          { seat: 'p3', city: 'paris' },
          { seat: 'p2', city: 'london' },
        ],
        ['chicago', 'montreal', 'new-york'],
      ),
    );
    expect(offered.pending).toMatchObject({ waiting: ['p3', 'p2'] });
    const half = applyCureOffer(offered, 'p2', { type: 'cure-accept' });
    expect(half.pending).toMatchObject({ kind: 'cure', waiting: ['p3'] });
    expect(half.cures.blue).toBe('none');
    // Not yet: the cards stay until the last helper agrees.
    expect(half.hands.p2).toHaveLength(2);
    const done = applyCureOffer(half, 'p3', { type: 'cure-accept' });
    expect(done.cures.blue).toBe('cured');
    expect(done.hands.p3).toEqual([]);
    expect(done.hands.p2).toHaveLength(1);
  });

  it('is called off when a helper declines or the player cancels, with nothing lost', () => {
    const offered = applyMove(helped(), 'p1', cure([...both]));
    for (const [seat, move] of [
      ['p2', { type: 'cure-decline' }],
      ['p1', { type: 'cure-cancel' }],
    ] as const) {
      const off = applyCureOffer(offered, seat, move);
      expect(off.pending).toBeNull();
      expect(off.cures.blue).toBe('none');
      expect(off.hands.p1).toHaveLength(3);
      expect(off.hands.p2).toHaveLength(2);
      expect(off.turn.actionsLeft).toBe(4);
    }
  });

  it('is answered only by the helpers it waits for, and cancelled only by the player', () => {
    const offered = applyMove(helped(), 'p1', cure([...both]));
    expect(checkCureOffer(offered, 'p3', { type: 'cure-accept' })).toMatchObject({
      reason: 'not-your-answer',
    });
    expect(checkCureOffer(offered, 'p1', { type: 'cure-accept' })).toMatchObject({
      reason: 'not-your-answer',
    });
    expect(checkCureOffer(offered, 'p2', { type: 'cure-cancel' })).toMatchObject({
      reason: 'not-your-turn',
    });
    expect(checkCureOffer(helped(), 'p2', { type: 'cure-accept' })).toMatchObject({
      reason: 'no-offer',
    });
  });

  it('must still be legal when accepted: a card that left the helper’s hand refuses it', () => {
    const offered = applyMove(helped(), 'p1', cure([...both]));
    offered.hands.p2 = cities('london');
    expect(checkCureOffer(offered, 'p2', { type: 'cure-accept' })).toMatchObject({
      reason: 'bad-cards',
    });
  });

  it('wins the game when it is the last cure', () => {
    const game = helped();
    game.cures = { blue: 'none', yellow: 'cured', black: 'cured', red: 'cured' };
    const offered = applyMove(game, 'p1', cure([...both]));
    expect(applyCureOffer(offered, 'p2', { type: 'cure-accept' }).status).toBe('won');
  });

  it('counts a Teacher’s student in the city as the Teacher being there', () => {
    const game = helped();
    game.roles.p2 = 'teacher';
    game.pawns.p2 = 'tokyo';
    game.pawns['p2-s1'] = 'atlanta';
    expect(why(game, 'p1', cure([...both]))).toBe('ok');
  });

  it('refuses what the rules do not allow', () => {
    const game = helped();
    // More than 2 cards from others (and so not 5 with all of its own).
    game.hands.p1 = cities('chicago', 'montreal');
    game.hands.p2 = cities('london', 'madrid', 'paris');
    expect(
      why(
        game,
        'p1',
        cure(
          [
            { seat: 'p2', city: 'london' },
            { seat: 'p2', city: 'madrid' },
            { seat: 'p2', city: 'paris' },
          ],
          ['chicago', 'montreal'],
        ),
      ),
    ).toBe('wrong-role');
    // A helper in another city, itself as the helper, a seat not in the game.
    const away = helped();
    away.pawns.p2 = 'tokyo';
    expect(why(away, 'p1', cure([...both]))).toBe('not-together');
    expect(why(helped(), 'p1', cure([{ seat: 'p1', city: 'chicago' }], ['montreal']))).toBe(
      'bad-partner',
    );
    expect(why(helped(), 'p1', cure([{ seat: 'p4', city: 'london' }]))).toBe('bad-partner');
    // Cards that are not held, the wrong color, the wrong number, a card twice.
    expect(why(helped(), 'p1', cure([{ seat: 'p2', city: 'paris' }, ...both.slice(0, 1)]))).toBe(
      'bad-cards',
    );
    expect(why(helped(), 'p1', cure([{ seat: 'p2', city: 'london' }]))).toBe('bad-cards');
    const wrong = helped();
    wrong.hands.p2 = cities('london', 'tokyo');
    expect(
      why(
        wrong,
        'p1',
        cure([
          { seat: 'p2', city: 'london' },
          { seat: 'p2', city: 'tokyo' },
        ]),
      ),
    ).toBe('bad-cards');
    expect(
      why(
        helped(),
        'p1',
        cure([
          { seat: 'p2', city: 'london' },
          { seat: 'p2', city: 'london' },
        ]),
      ),
    ).toBe('bad-cards');
    // Not at a station, already cured, another role.
    const noStation = helped();
    noStation.stations = ['chicago'];
    expect(why(noStation, 'p1', cure([...both]))).toBe('no-station');
    const cured = helped();
    cured.cures.blue = 'cured';
    expect(why(cured, 'p1', cure([...both]))).toBe('already-cured');
    const other = helped();
    other.roles.p1 = 'medic';
    expect(why(other, 'p1', cure([...both]))).toBe('wrong-role');
    expect(checkCure(helped(), 'p1', { type: 'cure', color: 'blue', cards: [], help: [] }).ok).toBe(
      false,
    );
  });
});

describe('the move schema', () => {
  const ok = (move: unknown) => pandemic.moveSchema.safeParse(move).success;

  it('knows the Z-Force moves and the answers to a helped cure', () => {
    expect(ok({ type: 'montreal-essen', to: 'essen' })).toBe(true);
    expect(ok({ type: 'montreal-essen', to: 'nowhere' })).toBe(false);
    expect(
      ok({
        type: 'cure',
        color: 'blue',
        cards: ['chicago'],
        help: [{ seat: 'p2', city: 'london' }],
      }),
    ).toBe(true);
    expect(
      ok({ type: 'cure', color: 'blue', cards: [], help: [{ seat: 'p9', city: 'london' }] }),
    ).toBe(false);
    for (const type of ['cure-accept', 'cure-decline', 'cure-cancel'])
      expect(ok({ type })).toBe(true);
  });
});

describe('random play with the Z-Force Team Member', () => {
  it('makes a helped cure when that is the only cure, and answers an offer', () => {
    const game = helped();
    game.hands.p1 = cities('chicago', 'montreal', 'new-york');
    game.hands.p2 = cities('london', 'madrid');
    // 0.99 never picks a role power, an event or a cancel.
    const next = agentMove(game, () => 0.99);
    expect(next).toMatchObject({ by: 'p1', move: { type: 'cure', color: 'blue' } });
    expect((next.move as { help?: unknown[] }).help).toHaveLength(2);

    const offered = applyMove(game, 'p1', next.move as PandemicMove);
    const answer = agentMove(offered, () => 0.5);
    expect(answer).toEqual({ by: 'p2', move: { type: 'cure-accept' } });
  });

  it('plays and replays through the engine kit, moving to Montreal and Essen on the way', () => {
    let moves = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const players = 2 + (seed % 3);
      const { final, moves: played } = checkGame({
        definition: pandemic,
        config: { players, epidemics: 4, roleMode: 'choose' },
        seats: SEATS.slice(0, players),
        seed,
        // p1 takes the Z-Force Team Member first, and takes it back if the agent switched its pick.
        nextMove: (state, random) => {
          if (state.status === 'setup' && state.picks.p1 !== 'z-force-team-member') {
            if (!state.confirmed.includes('p1')) {
              return {
                by: 'p1',
                move: { type: 'pick-role', role: 'z-force-team-member' } as const,
              };
            }
          }
          return agentMove(state, random);
        },
        maxSteps: 3000,
      });
      expect((final as GameState).roles.p1).toBe('z-force-team-member');
      for (const { move } of played) {
        if ((move as PandemicMove).type === 'montreal-essen') moves += 1;
      }
    }
    expect(moves).toBeGreaterThan(0);
  });
});
