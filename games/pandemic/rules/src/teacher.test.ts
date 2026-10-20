// The Teacher (a fan-made role) and the pawn a seat acts with: creating students, choosing the
// pawn for a turn, and every basic action working on the chosen pawn.
import { checkGame } from '@platform/engine/testing';
import { describe, expect, it } from 'vitest';
import { applyAction, checkAction, movePawn, type Action, type ActionReason } from './actions';
import { pandemic } from './definition';
import { applyMove, checkMove, type PandemicMove } from './moves';
import { actingPawn, pawnsOf, startingPawn } from './pawns';
import { agentMove } from './random-play';
import { applyMoveOffer } from './moveOffer';
import { MAX_STUDENTS } from './roles';
import { applyShare, checkShare } from './share';
import { addCubes, blankGame, city, give } from './test-utils';
import { applyTurnMove } from './turn';
import { PAWN_IDS, SEATS, pawnOwner, type GameState, type PawnId } from './types';
import { viewFor } from './views';

/** A 3-player game where p1 is the Teacher; its turn starts with the teacher pawn. */
function teacherGame(): GameState {
  const game = blankGame(3);
  game.roles.p1 = 'teacher';
  return game;
}

/** The Teacher with a student in Chicago and the choice still to make (a turn with students). */
function withStudent(): GameState {
  const game = teacherGame();
  game.pawns['p1-s1'] = 'chicago';
  game.turn.pawn = null;
  return game;
}

const why = (game: GameState, seat: 'p1' | 'p2' | 'p3', move: PandemicMove): string => {
  const check = checkMove(game, seat, move);
  return check.ok ? 'ok' : check.reason;
};
const choose = (game: GameState, pawn: PawnId): GameState =>
  applyMove(game, 'p1', { type: 'choose-pawn', pawn });
const create: PandemicMove = { type: 'create-student' };

describe('pawn ids', () => {
  it('name a seat’s own pawn and its two students', () => {
    expect(PAWN_IDS).toHaveLength(SEATS.length * (1 + MAX_STUDENTS));
    expect(pawnOwner('p3')).toBe('p3');
    expect(pawnOwner('p3-s2')).toBe('p3');
  });

  it('list a seat’s pawns, its own first', () => {
    const game = withStudent();
    game.pawns['p1-s2'] = 'atlanta';
    expect(pawnsOf(game, 'p1')).toEqual(['p1', 'p1-s1', 'p1-s2']);
    expect(pawnsOf(game, 'p2')).toEqual(['p2']);
  });
});

describe('creating a student', () => {
  it('puts a student in the teacher pawn’s city and spends an action', () => {
    const game = teacherGame();
    game.pawns.p1 = 'paris';
    const next = applyMove(game, 'p1', create);
    expect(next.pawns['p1-s1']).toBe('paris');
    expect(next.pawns.p1).toBe('paris');
    expect(next.turn.actionsLeft).toBe(3);
    // The teacher pawn stays the pawn of the turn.
    expect(next.turn.pawn).toBe('p1');
  });

  it('numbers the students, and allows two a game', () => {
    let game = teacherGame();
    game = applyMove(game, 'p1', create);
    game = applyMove(game, 'p1', create);
    expect(pawnsOf(game, 'p1')).toEqual(['p1', 'p1-s1', 'p1-s2']);
    expect(why(game, 'p1', create)).toBe('no-students-left');
  });

  it('can make both students in one turn, and the second where the teacher is', () => {
    let game = teacherGame();
    game = applyMove(game, 'p1', create);
    game = applyMove(game, 'p1', { type: 'drive', to: 'chicago' });
    game = applyMove(game, 'p1', create);
    expect(game.pawns).toMatchObject({ p1: 'chicago', 'p1-s1': 'atlanta', 'p1-s2': 'chicago' });
  });

  it('is only the Teacher’s, and only from the teacher pawn', () => {
    const game = teacherGame();
    expect(why(game, 'p1', create)).toBe('ok');
    const other = blankGame(3);
    expect(why(other, 'p1', create)).toBe('wrong-role');

    const student = choose(withStudent(), 'p1-s1');
    expect(why(student, 'p1', create)).toBe('teacher-pawn-only');
  });

  it('is an action: it needs the turn, and an action left', () => {
    const game = teacherGame();
    expect(why(game, 'p2', create)).toBe('not-your-turn');
    game.turn.actionsLeft = 0;
    expect(why(game, 'p1', create)).toBe('no-actions-left');
  });

  it('gives a student no power of its own: the owner’s role hooks only run for its own pawn', () => {
    // A student arriving does not run its owner's role hook (the Medic's would clear cubes).
    const game = teacherGame();
    game.roles.p1 = 'medic';
    game.pawns['p1-s1'] = 'atlanta';
    game.cures.blue = 'cured';
    addCubes(game, 'chicago', 'blue', 2);
    movePawn(game, 'p1-s1', 'chicago');
    expect(game.cubes.chicago.blue).toBe(2);
    // The seat's own pawn does.
    movePawn(game, 'p1', 'chicago');
    expect(game.cubes.chicago.blue).toBe(0);
  });
});

describe('choosing the pawn for the turn', () => {
  it('starts a turn with the seat’s own pawn when it has no students', () => {
    const game = teacherGame();
    expect(game.turn.pawn).toBe('p1');
    expect(startingPawn(game, 'p1')).toBe('p1');
    expect(startingPawn(game, 'p2')).toBe('p2');
  });

  it('asks a seat with students, and no action works before it answers', () => {
    const game = withStudent();
    expect(startingPawn(game, 'p1')).toBeNull();
    for (const move of [
      { type: 'drive', to: 'chicago' },
      { type: 'treat', color: 'blue' },
      { type: 'build' },
      { type: 'pass' },
      create,
      { type: 'share-offer', direction: 'give', with: 'p2' },
    ] as PandemicMove[]) {
      expect(why(game, 'p1', move)).toBe('choose-pawn-first');
    }
  });

  it('fixes the pawn for the turn', () => {
    const chosen = choose(withStudent(), 'p1-s1');
    expect(chosen.turn.pawn).toBe('p1-s1');
    expect(chosen.turn.actionsLeft).toBe(4);
    expect(actingPawn(chosen, 'p1')).toBe('p1-s1');
    // No second choice, not even the same pawn again.
    expect(why(chosen, 'p1', { type: 'choose-pawn', pawn: 'p1' })).toBe('pawn-chosen');
    expect(why(chosen, 'p1', { type: 'choose-pawn', pawn: 'p1-s1' })).toBe('pawn-chosen');
  });

  it('is only for the player whose turn it is, among their own pawns, at the start of actions', () => {
    const game = withStudent();
    expect(why(game, 'p2', { type: 'choose-pawn', pawn: 'p1-s1' })).toBe('not-your-turn');
    expect(why(game, 'p1', { type: 'choose-pawn', pawn: 'p2' })).toBe('not-your-pawn');
    expect(why(game, 'p1', { type: 'choose-pawn', pawn: 'p1-s2' })).toBe('not-your-pawn');
    expect(why({ ...game, status: 'won' }, 'p1', { type: 'choose-pawn', pawn: 'p1' })).toBe(
      'game-over',
    );
    expect(
      why({ ...game, turn: { ...game.turn, step: 'draw' } }, 'p1', {
        type: 'choose-pawn',
        pawn: 'p1',
      }),
    ).toBe('wrong-step');
    expect(
      why({ ...game, pending: { kind: 'discard', seat: 'p1' } }, 'p1', {
        type: 'choose-pawn',
        pawn: 'p1',
      }),
    ).toBe('answer-first');
  });

  it('ends with the turn: the next turn of a Teacher with students asks again, others do not', () => {
    const game = withStudent();
    game.turn = { ...game.turn, seat: 'p3', pawn: 'p3', step: 'infect', infectionsLeft: 1 };
    game.infectionDeck = ['lima'];
    const next = applyTurnMove(game, 'p3', { type: 'infect' });
    expect(next.turn).toMatchObject({ seat: 'p1', pawn: null });

    const plain = teacherGame();
    plain.turn = { ...plain.turn, seat: 'p3', pawn: 'p3', step: 'infect', infectionsLeft: 1 };
    plain.infectionDeck = ['lima'];
    expect(applyTurnMove(plain, 'p3', { type: 'infect' }).turn).toMatchObject({
      seat: 'p1',
      pawn: 'p1',
    });
  });

  it('is taken back by Restart turn', () => {
    const chosen = choose(withStudent(), 'p1-s1');
    const moved = applyMove(chosen, 'p1', { type: 'drive', to: 'montreal' });
    expect(moved.pawns['p1-s1']).toBe('montreal');
    const back = applyMove(moved, 'p1', { type: 'restart-turn' });
    expect(back.pawns['p1-s1']).toBe('chicago');
    expect(back.turn.pawn).toBeNull();
  });

  it('is part of every view, with the students on the map', () => {
    const view = viewFor(choose(withStudent(), 'p1-s1'), 'p2');
    expect(view.turn.pawn).toBe('p1-s1');
    expect(view.pawns['p1-s1']).toBe('chicago');
  });
});

describe('basic actions of the chosen pawn', () => {
  const asStudent = (): GameState => choose(withStudent(), 'p1-s1');
  const refused = (game: GameState, action: Action): ActionReason | 'ok' => {
    const check = checkAction(game, 'p1', action);
    return check.ok ? 'ok' : check.reason;
  };

  it('drives the student, not the teacher', () => {
    const game = applyAction(asStudent(), 'p1', { type: 'drive', to: 'montreal' });
    expect(game.pawns).toMatchObject({ p1: 'atlanta', 'p1-s1': 'montreal' });
    expect(game.turn.actionsLeft).toBe(3);
    // Chicago to Montreal is a link of the student's city; Atlanta to Montreal is not one.
    expect(refused(asStudent(), { type: 'drive', to: 'washington' })).toBe('not-adjacent');
  });

  it('flies the student, paying with the Teacher’s hand: direct, and charter from the student’s city', () => {
    const direct = asStudent();
    give(direct, 'p1', city('tokyo'));
    const flown = applyAction(direct, 'p1', { type: 'direct', to: 'tokyo' });
    expect(flown.pawns['p1-s1']).toBe('tokyo');
    expect(flown.hands.p1).toEqual([]);

    // A charter discards the card of the city the student is in, not the teacher's.
    const charter = asStudent();
    give(charter, 'p1', city('atlanta'));
    expect(refused(charter, { type: 'charter', to: 'tokyo' })).toBe('card-missing');
    give(charter, 'p1', city('chicago'));
    const chartered = applyAction(charter, 'p1', { type: 'charter', to: 'tokyo' });
    expect(chartered.pawns).toMatchObject({ p1: 'atlanta', 'p1-s1': 'tokyo' });
    expect(chartered.hands.p1).toEqual([city('atlanta')]);
  });

  it('shuttles the student between stations', () => {
    const game = asStudent();
    expect(refused(game, { type: 'shuttle', to: 'atlanta' })).toBe('no-station');
    game.stations = ['atlanta', 'chicago'];
    const shuttled = applyAction(game, 'p1', { type: 'shuttle', to: 'atlanta' });
    expect(shuttled.pawns['p1-s1']).toBe('atlanta');
  });

  it('builds in the student’s city with that city’s card', () => {
    const game = asStudent();
    give(game, 'p1', city('atlanta'));
    expect(refused(game, { type: 'build' })).toBe('card-missing');
    give(game, 'p1', city('chicago'));
    const built = applyAction(game, 'p1', { type: 'build' });
    expect(built.stations).toContain('chicago');
    expect(built.hands.p1).toEqual([city('atlanta')]);
  });

  it('treats the student’s city', () => {
    const game = asStudent();
    addCubes(game, 'chicago', 'blue', 2);
    expect(refused(game, { type: 'treat', color: 'red' })).toBe('no-cubes');
    const treated = applyAction(game, 'p1', { type: 'treat', color: 'blue' });
    expect(treated.cubes.chicago.blue).toBe(1);
    // The teacher pawn's city has none: with the teacher chosen the same action is refused.
    const teacher = choose(withStudent(), 'p1');
    addCubes(teacher, 'chicago', 'blue', 2);
    expect(refused(teacher, { type: 'treat', color: 'blue' })).toBe('no-cubes');
  });

  it('discovers a cure at a station in the student’s city', () => {
    const game = asStudent();
    const cards = ['chicago', 'essen', 'milan', 'san-francisco', 'washington'] as const;
    give(game, 'p1', ...cards.map(city));
    const cure: Action = { type: 'cure', color: 'blue', cards: [...cards] };
    // The station is in Atlanta, where the teacher is; the student is in Chicago.
    expect(refused(game, cure)).toBe('no-station');
    game.stations = ['chicago'];
    expect(refused(game, cure)).toBe('ok');
    expect(applyAction(game, 'p1', cure).cures.blue).not.toBe('none');
  });

  it('passes, and then the turn moves on from the chosen pawn', () => {
    expect(applyAction(asStudent(), 'p1', { type: 'pass' }).turn.step).toBe('draw');
  });
});

describe('Share Knowledge with a student', () => {
  const give1 = { type: 'share-offer', direction: 'give', with: 'p2' } as const;

  it('happens where the chosen pawn is: a student in Chicago shares with a player in Chicago', () => {
    const game = choose(withStudent(), 'p1-s1');
    give(game, 'p1', city('chicago'));
    // p2 is in Atlanta, with the teacher pawn.
    expect(checkShare(game, 'p1', give1)).toEqual({ ok: false, reason: 'not-together' });
    game.pawns.p2 = 'chicago';
    const offered = applyShare(game, 'p1', give1);
    expect(offered.pending).toEqual({ kind: 'share', from: 'p1', to: 'p2', city: 'chicago' });
    expect(applyShare(offered, 'p2', { type: 'share-accept' }).hands.p2).toEqual([city('chicago')]);
  });

  it('counts the partner’s student as the partner being there', () => {
    const game = teacherGame();
    game.turn.seat = 'p2';
    game.turn.pawn = 'p2';
    game.pawns.p1 = 'tokyo';
    game.pawns['p1-s1'] = 'atlanta';
    give(game, 'p2', city('atlanta'));
    expect(checkShare(game, 'p2', { type: 'share-offer', direction: 'give', with: 'p1' }).ok).toBe(
      true,
    );
  });
});

describe('moving a student', () => {
  it('is an offer to its owner when a Dispatcher moves it', () => {
    const game = teacherGame();
    game.roles.p2 = 'dispatcher';
    game.pawns['p1-s1'] = 'atlanta';
    game.turn.seat = 'p2';
    game.turn.pawn = 'p2';
    const offered = applyMove(game, 'p2', { type: 'drive', to: 'chicago', pawn: 'p1-s1' });
    expect(offered.pending).toMatchObject({ kind: 'move', by: 'p2', pawn: 'p1-s1' });
    expect(offered.pawns['p1-s1']).toBe('atlanta');
    expect(pandemic.actors(offered)).toEqual([{ seat: 'p1', kind: 'prompt', prompt: 'move' }]);
    // Only the owner answers.
    expect(checkMove(offered, 'p3', { type: 'move-accept' }).ok).toBe(false);
    const done = applyMoveOffer(offered, 'p1', { type: 'move-accept' });
    expect(done.pawns['p1-s1']).toBe('chicago');
  });

  it('is playable with Airlift on any pawn: a student of another player needs its owner', () => {
    const game = teacherGame();
    game.pawns['p1-s1'] = 'atlanta';
    game.turn.seat = 'p2';
    game.turn.pawn = 'p2';
    game.hands.p2 = [{ kind: 'event', event: 'airlift' }];
    const play = {
      type: 'play-event',
      event: 'airlift',
      pawn: 'p1-s1',
      to: 'tokyo',
    } as const;
    const offered = applyMove(game, 'p2', play);
    expect(offered.pending).toMatchObject({ kind: 'move', pawn: 'p1-s1' });
    expect(applyMoveOffer(offered, 'p1', { type: 'move-accept' }).pawns['p1-s1']).toBe('tokyo');
    // A pawn that is not on the map is refused.
    expect(why(game, 'p2', { ...play, pawn: 'p3-s1' })).toBe('bad-partner');
  });

  it('can be joined to another pawn by a Dispatcher, students included', () => {
    const game = teacherGame();
    game.roles.p2 = 'dispatcher';
    game.pawns['p1-s1'] = 'tokyo';
    game.turn.seat = 'p2';
    game.turn.pawn = 'p2';
    expect(why(game, 'p2', { type: 'join', to: 'tokyo' })).toBe('ok');
  });
});

describe('the move schema', () => {
  const ok = (move: unknown) => pandemic.moveSchema.safeParse(move).success;

  it('knows the new moves and every pawn id', () => {
    expect(ok({ type: 'create-student' })).toBe(true);
    expect(ok({ type: 'choose-pawn', pawn: 'p2-s1' })).toBe(true);
    expect(ok({ type: 'choose-pawn', pawn: 'p2-s3' })).toBe(false);
    expect(ok({ type: 'choose-pawn', pawn: 'p5' })).toBe(false);
    expect(ok({ type: 'drive', to: 'chicago', pawn: 'p1-s2' })).toBe(true);
    expect(ok({ type: 'play-event', event: 'airlift', pawn: 'p3-s1', to: 'paris' })).toBe(true);
  });
});

describe('random games with a Teacher', () => {
  it('play and replay through the engine kit, creating students on the way', () => {
    let created = 0;
    let chosen = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const players = 2 + (seed % 3);
      const { final, moves } = checkGame({
        definition: pandemic,
        config: { players, epidemics: 4, roleMode: 'choose' },
        seats: SEATS.slice(0, players),
        seed,
        // p1 takes the Teacher first, and takes it back if the agent switched its pick.
        nextMove: (state, random) => {
          if (state.status === 'setup' && state.picks.p1 !== 'teacher') {
            if (!state.confirmed.includes('p1')) {
              return { by: 'p1', move: { type: 'pick-role', role: 'teacher' } as const };
            }
          }
          return agentMove(state, random);
        },
        maxSteps: 3000,
      });
      expect((final as GameState).roles.p1).toBe('teacher');
      for (const { move } of moves) {
        if ((move as PandemicMove).type === 'create-student') created += 1;
        if ((move as PandemicMove).type === 'choose-pawn') chosen += 1;
      }
    }
    expect(created).toBeGreaterThan(0);
    expect(chosen).toBeGreaterThan(0);
  });
});
