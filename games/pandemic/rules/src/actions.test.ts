import { describe, expect, it } from 'vitest';
import { applyAction, checkAction, cubesOnBoard, type Action, type ActionReason } from './actions';
import { addCubes, blankGame, city, give } from './test-utils';
import type { GameState } from './types';

const refused = (
  game: GameState,
  action: Action,
  seat: 'p1' | 'p2' = 'p1',
): ActionReason | 'ok' => {
  const check = checkAction(game, seat, action);
  return check.ok ? 'ok' : check.reason;
};

describe('turn rules', () => {
  it('refuses another seat, a finished game, a wrong step and an open question', () => {
    const game = blankGame();
    expect(refused(game, { type: 'pass' }, 'p2')).toBe('not-your-turn');
    expect(refused({ ...game, status: 'won' }, { type: 'pass' })).toBe('game-over');
    expect(refused({ ...game, turn: { ...game.turn, step: 'draw' } }, { type: 'pass' })).toBe(
      'wrong-step',
    );
    expect(refused({ ...game, pending: { kind: 'discard', seat: 'p1' } }, { type: 'pass' })).toBe(
      'answer-first',
    );
    expect(refused({ ...game, turn: { ...game.turn, actionsLeft: 0 } }, { type: 'pass' })).toBe(
      'no-actions-left',
    );
  });

  it('counts four actions, then waits for the draw', () => {
    let game = blankGame();
    const route = ['chicago', 'atlanta', 'chicago', 'atlanta'] as const;
    route.forEach((to, i) => {
      expect(game.turn.actionsLeft).toBe(4 - i);
      expect(game.turn.step).toBe('actions');
      game = applyAction(game, 'p1', { type: 'drive', to });
    });
    expect(game.turn).toMatchObject({ actionsLeft: 0, step: 'draw' });
    expect(refused(game, { type: 'drive', to: 'chicago' })).toBe('wrong-step');
  });

  it('lets a player pass, forgetting the actions left', () => {
    const game = applyAction(blankGame(), 'p1', { type: 'pass' });
    expect(game.turn).toMatchObject({ actionsLeft: 0, step: 'draw' });
  });

  it('does not change the state it was given', () => {
    const game = blankGame();
    const before = structuredClone(game);
    applyAction(game, 'p1', { type: 'drive', to: 'chicago' });
    expect(game).toEqual(before);
  });

  it('throws on an illegal action', () => {
    expect(() => applyAction(blankGame(), 'p1', { type: 'drive', to: 'tokyo' })).toThrow();
  });
});

describe('movement', () => {
  it('drives along a white line, including the Pacific ones', () => {
    const game = blankGame();
    expect(refused(game, { type: 'drive', to: 'chicago' })).toBe('ok');
    expect(refused(game, { type: 'drive', to: 'tokyo' })).toBe('not-adjacent');
    expect(refused(game, { type: 'drive', to: 'atlanta' })).toBe('same-city');
    game.pawns.p1 = 'san-francisco';
    expect(applyAction(game, 'p1', { type: 'drive', to: 'tokyo' }).pawns.p1).toBe('tokyo');
    game.pawns.p1 = 'sydney';
    expect(applyAction(game, 'p1', { type: 'drive', to: 'los-angeles' }).pawns.p1).toBe(
      'los-angeles',
    );
  });

  it('flies direct by discarding the card of the destination', () => {
    const game = blankGame();
    give(game, 'p1', city('tokyo'));
    expect(refused(game, { type: 'direct', to: 'paris' })).toBe('card-missing');
    expect(refused(game, { type: 'direct', to: 'atlanta' })).toBe('same-city');
    const next = applyAction(game, 'p1', { type: 'direct', to: 'tokyo' });
    expect(next.pawns.p1).toBe('tokyo');
    expect(next.hands.p1).toEqual([]);
    expect(next.playerDiscard).toEqual([city('tokyo')]);
    expect(next.turn.actionsLeft).toBe(3);
  });

  it('charters from the city it is in, with that city card', () => {
    const game = blankGame();
    give(game, 'p1', city('tokyo'));
    expect(refused(game, { type: 'charter', to: 'paris' })).toBe('card-missing');
    give(game, 'p1', city('atlanta'));
    expect(refused(game, { type: 'charter', to: 'atlanta' })).toBe('same-city');
    const next = applyAction(game, 'p1', { type: 'charter', to: 'sydney' });
    expect(next.pawns.p1).toBe('sydney');
    expect(next.hands.p1).toEqual([city('tokyo')]);
    expect(next.playerDiscard).toEqual([city('atlanta')]);
  });

  it('shuttles only between two stations, with no card', () => {
    const game = blankGame();
    expect(refused(game, { type: 'shuttle', to: 'tokyo' })).toBe('no-station');
    game.stations.push('tokyo');
    expect(refused(game, { type: 'shuttle', to: 'atlanta' })).toBe('same-city');
    expect(applyAction(game, 'p1', { type: 'shuttle', to: 'tokyo' }).pawns.p1).toBe('tokyo');
    game.pawns.p1 = 'paris';
    expect(refused(game, { type: 'shuttle', to: 'tokyo' })).toBe('no-station');
  });

  it('moves only the player whose turn it is', () => {
    const game = blankGame();
    const next = applyAction(game, 'p1', { type: 'drive', to: 'chicago' });
    expect(next.pawns.p2).toBe('atlanta');
  });
});

describe('build a research station', () => {
  it('needs the card of the city and no station there yet', () => {
    const game = blankGame();
    game.pawns.p1 = 'paris';
    expect(refused(game, { type: 'build' })).toBe('card-missing');
    give(game, 'p1', city('paris'));
    const next = applyAction(game, 'p1', { type: 'build' });
    expect(next.stations).toEqual(['atlanta', 'paris']);
    expect(next.hands.p1).toEqual([]);
    expect(next.playerDiscard).toEqual([city('paris')]);
    give(next, 'p1', city('paris'));
    expect(refused({ ...next, turn: { ...next.turn, step: 'actions' } }, { type: 'build' })).toBe(
      'station-exists',
    );
  });

  it('takes a station from the board once all six are built', () => {
    const game = blankGame();
    game.stations = ['atlanta', 'chicago', 'london', 'delhi', 'tokyo', 'sydney'];
    game.pawns.p1 = 'paris';
    give(game, 'p1', city('paris'));
    expect(refused(game, { type: 'build' })).toBe('bad-station-to-move');
    expect(refused(game, { type: 'build', move: 'paris' })).toBe('bad-station-to-move');
    const next = applyAction(game, 'p1', { type: 'build', move: 'tokyo' });
    expect(next.stations).toHaveLength(6);
    expect(next.stations).toContain('paris');
    expect(next.stations).not.toContain('tokyo');
  });

  it('refuses a station to move while fewer than six are built', () => {
    const game = blankGame();
    game.pawns.p1 = 'paris';
    give(game, 'p1', city('paris'));
    expect(refused(game, { type: 'build', move: 'atlanta' })).toBe('bad-station-to-move');
  });
});

describe('treat disease', () => {
  it('removes one cube of an uncured disease and returns it to the supply', () => {
    const game = blankGame();
    addCubes(game, 'atlanta', 'blue', 3);
    const next = applyAction(game, 'p1', { type: 'treat', color: 'blue' });
    expect(next.cubes.atlanta.blue).toBe(2);
    expect(next.supply.blue).toBe(22);
    expect(refused(game, { type: 'treat', color: 'red' })).toBe('no-cubes');
  });

  it('removes every cube of a cured disease with one action, one color at a time', () => {
    const game = blankGame();
    addCubes(game, 'atlanta', 'blue', 3);
    addCubes(game, 'atlanta', 'red', 2);
    addCubes(game, 'chicago', 'blue', 1);
    game.cures.blue = 'cured';
    game.cures.red = 'cured';
    let next = applyAction(game, 'p1', { type: 'treat', color: 'blue' });
    expect(next.cubes.atlanta).toEqual({ blue: 0, yellow: 0, black: 0, red: 2 });
    expect(next.cures.blue).toBe('cured');
    next = applyAction(next, 'p1', { type: 'treat', color: 'red' });
    expect(next.cubes.atlanta.red).toBe(0);
    expect(next.cures.red).toBe('eradicated');
    expect(next.supply.red).toBe(24);
  });

  it('eradicates a cured disease when the last cube leaves the map', () => {
    const game = blankGame();
    addCubes(game, 'atlanta', 'blue', 1);
    game.cures.blue = 'cured';
    const next = applyAction(game, 'p1', { type: 'treat', color: 'blue' });
    expect(cubesOnBoard(next, 'blue')).toBe(0);
    expect(next.cures.blue).toBe('eradicated');
  });

  it('does nothing special when the last cube of an uncured disease goes', () => {
    const game = blankGame();
    addCubes(game, 'atlanta', 'blue', 1);
    const next = applyAction(game, 'p1', { type: 'treat', color: 'blue' });
    expect(next.cures.blue).toBe('none');
  });
});

describe('discover a cure', () => {
  const fiveBlue = ['chicago', 'london', 'essen', 'milan', 'paris'] as const;

  it('discards five cards of one color at a research station', () => {
    const game = blankGame();
    give(game, 'p1', ...fiveBlue.map(city), city('tokyo'));
    const next = applyAction(game, 'p1', { type: 'cure', color: 'blue', cards: [...fiveBlue] });
    expect(next.cures.blue).toBe('eradicated');
    expect(next.hands.p1).toEqual([city('tokyo')]);
    expect(next.playerDiscard).toHaveLength(5);
    expect(next.turn.actionsLeft).toBe(3);
    expect(next.status).toBe('playing');
  });

  it('is only cured, not eradicated, while cubes of the color remain', () => {
    const game = blankGame();
    give(game, 'p1', ...fiveBlue.map(city));
    addCubes(game, 'madrid', 'blue', 2);
    const next = applyAction(game, 'p1', { type: 'cure', color: 'blue', cards: [...fiveBlue] });
    expect(next.cures.blue).toBe('cured');
  });

  it('works at any station whatever its color, and only at a station', () => {
    const game = blankGame();
    give(game, 'p1', ...fiveBlue.map(city));
    game.pawns.p1 = 'tokyo';
    expect(refused(game, { type: 'cure', color: 'blue', cards: [...fiveBlue] })).toBe('no-station');
    game.stations.push('tokyo');
    expect(refused(game, { type: 'cure', color: 'blue', cards: [...fiveBlue] })).toBe('ok');
  });

  it('refuses too few cards, a repeated card, a wrong color, a missing card and a second cure', () => {
    const game = blankGame();
    give(game, 'p1', ...fiveBlue.map(city), city('tokyo'));
    const cure = (cards: (typeof fiveBlue)[number][] | string[]): Action =>
      ({ type: 'cure', color: 'blue', cards }) as Action;
    expect(refused(game, cure(fiveBlue.slice(0, 4)))).toBe('bad-cards');
    expect(refused(game, cure(['chicago', 'chicago', 'london', 'essen', 'milan']))).toBe(
      'bad-cards',
    );
    expect(refused(game, cure(['chicago', 'london', 'essen', 'milan', 'tokyo']))).toBe('bad-cards');
    expect(refused(game, cure(['chicago', 'london', 'essen', 'milan', 'montreal']))).toBe(
      'bad-cards',
    );
    game.cures.blue = 'cured';
    expect(refused(game, cure([...fiveBlue]))).toBe('already-cured');
  });

  it('wins the game when the fourth cure is found', () => {
    const game = blankGame();
    game.cures.yellow = 'cured';
    game.cures.black = 'cured';
    game.cures.red = 'cured';
    give(game, 'p1', ...fiveBlue.map(city));
    const next = applyAction(game, 'p1', { type: 'cure', color: 'blue', cards: [...fiveBlue] });
    expect(next.status).toBe('won');
  });
});
