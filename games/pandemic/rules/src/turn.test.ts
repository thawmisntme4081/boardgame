import { describe, expect, it } from 'vitest';
import type { ActionReason } from './actions';
import { addCubes, blankGame, city, give } from './test-utils';
import { applyTurnMove, checkTurnMove, type TurnMove } from './turn';
import type { GameState, PlayerCard, SeatId } from './types';

const why = (game: GameState, seat: SeatId, move: TurnMove): ActionReason | 'ok' => {
  const check = checkTurnMove(game, seat, move);
  return check.ok ? 'ok' : check.reason;
};

const epidemic: PlayerCard = { kind: 'epidemic' };

/** A game at the draw step with a chosen player deck and infection deck. */
function atDraw(
  playerDeck: PlayerCard[],
  infectionDeck: string[] = ['tokyo', 'paris', 'lima', 'cairo', 'osaka'],
) {
  const game = blankGame();
  game.turn.step = 'draw';
  game.turn.actionsLeft = 0;
  game.playerDeck = playerDeck;
  game.infectionDeck = infectionDeck as never;
  return game;
}

describe('draw', () => {
  it('takes the top 2 cards into the hand and starts the infect step', () => {
    const game = atDraw([city('paris'), city('lima'), city('cairo')]);
    const next = applyTurnMove(game, 'p1', { type: 'draw' });
    expect(next.hands.p1).toEqual([city('paris'), city('lima')]);
    expect(next.playerDeck).toEqual([city('cairo')]);
    expect(next.turn).toMatchObject({ step: 'infect', infectionsLeft: 2 });
  });

  it('is only for the active player at the draw step', () => {
    const game = atDraw([city('paris'), city('lima')]);
    expect(why(game, 'p2', { type: 'draw' })).toBe('not-your-turn');
    expect(why(blankGame(), 'p1', { type: 'draw' })).toBe('wrong-step');
    expect(why({ ...game, pending: { kind: 'discard', seat: 'p1' } }, 'p1', { type: 'draw' })).toBe(
      'answer-first',
    );
  });

  it('loses the game when fewer than 2 cards are left to draw', () => {
    const game = atDraw([city('paris')]);
    const next = applyTurnMove(game, 'p1', { type: 'draw' });
    expect(next.status).toBe('lost');
    expect(next.lossReason).toBe('player-deck');
  });

  it('draws the last 2 cards without losing', () => {
    const next = applyTurnMove(atDraw([city('paris'), city('lima')]), 'p1', { type: 'draw' });
    expect(next.status).toBe('playing');
    expect(next.playerDeck).toEqual([]);
  });

  it('sends an epidemic card to the epidemic step, with no replacement card', () => {
    const game = atDraw([epidemic, city('lima'), city('cairo')]);
    const next = applyTurnMove(game, 'p1', { type: 'draw' });
    expect(next.hands.p1).toEqual([city('lima')]);
    expect(next.turn).toMatchObject({ step: 'epidemic', epidemics: 1, epidemicStep: 'increase' });
    expect(next.playerDeck).toEqual([city('cairo')]);
  });
});

describe('hand limit', () => {
  const seven = ['chicago', 'paris', 'london', 'essen', 'milan', 'madrid', 'tokyo'] as const;

  it('makes a hand over 7 discard before infecting, even with a card', () => {
    const game = atDraw([city('lima'), city('cairo')]);
    give(game, 'p1', ...seven.slice(0, 6).map(city));
    const next = applyTurnMove(game, 'p1', { type: 'draw' });
    expect(next.hands.p1).toHaveLength(8);
    expect(next.pending).toEqual({ kind: 'discard', seat: 'p1' });
    expect(why(next, 'p1', { type: 'infect' })).toBe('answer-first');

    const after = applyTurnMove(next, 'p1', { type: 'discard', card: city('lima') });
    expect(after.pending).toBeNull();
    expect(after.hands.p1).toHaveLength(7);
    expect(after.playerDiscard).toEqual([city('lima')]);
    expect(why(after, 'p1', { type: 'infect' })).toBe('ok');
  });

  it('lets a player outside their turn discard what they owe', () => {
    const game = blankGame();
    give(game, 'p2', ...seven.map(city), city('lima'));
    game.pending = { kind: 'discard', seat: 'p2' };
    expect(why(game, 'p1', { type: 'discard', card: city('lima') })).toBe('not-your-answer');
    expect(why(game, 'p2', { type: 'discard', card: city('rio' as never) })).toBe('card-missing');
    const next = applyTurnMove(game, 'p2', { type: 'discard', card: city('lima') });
    expect(next.pending).toBeNull();
    expect(next.hands.p2).toHaveLength(7);
  });

  it('keeps asking until the hand is back to 7', () => {
    const game = blankGame();
    give(game, 'p1', ...seven.map(city), city('lima'), city('cairo'));
    game.pending = { kind: 'discard', seat: 'p1' };
    const once = applyTurnMove(game, 'p1', { type: 'discard', card: city('lima') });
    expect(once.pending).toEqual({ kind: 'discard', seat: 'p1' });
    const twice = applyTurnMove(once, 'p1', { type: 'discard', card: city('cairo') });
    expect(twice.pending).toBeNull();
  });

  it('refuses a discard when nothing is owed', () => {
    const game = blankGame();
    give(game, 'p1', city('lima'));
    expect(why(game, 'p1', { type: 'discard', card: city('lima') })).toBe('nothing-to-discard');
  });

  it('counts events in the hand and lets one be discarded', () => {
    const game = blankGame();
    give(game, 'p1', ...seven.map(city), { kind: 'event', event: 'airlift' });
    game.pending = { kind: 'discard', seat: 'p1' };
    const next = applyTurnMove(game, 'p1', {
      type: 'discard',
      card: { kind: 'event', event: 'airlift' },
    });
    expect(next.pending).toBeNull();
  });
});

describe('infect step', () => {
  const infectStep = (rate: number, deck: string[]) => {
    const game = atDraw([city('paris'), city('lima')], deck);
    game.infectionRate = rate;
    return applyTurnMove(game, 'p1', { type: 'draw' });
  };

  it('flips one card per move, as many as the infection rate, then passes the turn', () => {
    let game = infectStep(0, ['tokyo', 'paris', 'lima']);
    expect(game.turn.infectionsLeft).toBe(2);
    game = applyTurnMove(game, 'p1', { type: 'infect' });
    expect(game.cubes.tokyo.red).toBe(1);
    expect(game.infectionDiscard).toEqual(['tokyo']);
    expect(game.turn).toMatchObject({ seat: 'p1', infectionsLeft: 1, step: 'infect' });
    game = applyTurnMove(game, 'p1', { type: 'infect' });
    expect(game.cubes.paris.blue).toBe(1);
    expect(game.infectionDiscard).toEqual(['tokyo', 'paris']);
    expect(game.infectionDeck).toEqual(['lima']);
    expect(game.turn).toMatchObject({ seat: 'p2', step: 'actions', actionsLeft: 4 });
  });

  it('flips 2, 2, 2, 3, 3, 4, 4 cards as the marker advances', () => {
    const rates = [0, 1, 2, 3, 4, 5, 6].map((rate) => infectStep(rate, []).turn.infectionsLeft);
    expect(rates).toEqual([2, 2, 2, 3, 3, 4, 4]);
  });

  it('wraps the turn order after the last seat', () => {
    const game = blankGame();
    game.turn = { ...game.turn, seat: 'p2', step: 'infect', infectionsLeft: 1 };
    game.infectionDeck = ['lima'];
    expect(applyTurnMove(game, 'p2', { type: 'infect' }).turn.seat).toBe('p1');
  });

  it('can start an outbreak, and stops the turn if the game is lost', () => {
    const game = blankGame();
    game.turn = { ...game.turn, step: 'infect', infectionsLeft: 2 };
    game.infectionDeck = ['atlanta', 'lima'];
    game.outbreaks = 7;
    addCubes(game, 'atlanta', 'blue', 3);
    const next = applyTurnMove(game, 'p1', { type: 'infect' });
    expect(next.status).toBe('lost');
    expect(next.turn.seat).toBe('p1');
    expect(why(next, 'p1', { type: 'infect' })).toBe('game-over');
  });

  it('puts nothing on an eradicated color and still discards the card', () => {
    const game = blankGame();
    game.turn = { ...game.turn, step: 'infect', infectionsLeft: 1 };
    game.infectionDeck = ['tokyo'];
    game.cures.red = 'eradicated';
    const next = applyTurnMove(game, 'p1', { type: 'infect' });
    expect(next.cubes.tokyo.red).toBe(0);
    expect(next.infectionDiscard).toEqual(['tokyo']);
  });
});

describe('epidemic', () => {
  /** Draws an epidemic on a game with a known infection deck and discard pile. */
  const drawn = (count = 1) => {
    const game = atDraw(
      Array.from({ length: count }, () => epidemic).concat(
        Array.from({ length: 2 - Math.min(count, 2) }, () => city('lima') as never),
      ),
      ['tokyo', 'paris', 'cairo', 'osaka'],
    );
    game.infectionDiscard = ['sydney', 'lima'];
    return applyTurnMove(game, 'p1', { type: 'draw' });
  };

  it('increases, infects the bottom card with 3 cubes, then intensifies', () => {
    let game = drawn();
    game = applyTurnMove(game, 'p1', { type: 'epidemic' });
    expect(game.infectionRate).toBe(1);
    expect(game.turn.epidemicStep).toBe('infect');

    game = applyTurnMove(game, 'p1', { type: 'epidemic' });
    expect(game.cubes.osaka.red).toBe(3);
    expect(game.infectionDiscard).toEqual(['sydney', 'lima', 'osaka']);
    expect(game.infectionDeck).toEqual(['tokyo', 'paris', 'cairo']);
    expect(game.turn.epidemicStep).toBe('intensify');
    expect(game.turn.step).toBe('epidemic');

    game = applyTurnMove(game, 'p1', { type: 'epidemic' });
    expect(game.infectionDiscard).toEqual([]);
    expect(game.infectionDeck).toHaveLength(6);
    expect(game.infectionDeck.slice(3).sort()).toEqual(['cairo', 'paris', 'tokyo'].sort());
    expect(game.infectionDeck.slice(3)).toEqual(['tokyo', 'paris', 'cairo']);
    expect([...game.infectionDeck.slice(0, 3)].sort()).toEqual(['lima', 'osaka', 'sydney']);
    expect(game.turn).toMatchObject({ step: 'infect', epidemics: 0 });
  });

  it('infects the next cards at the new, higher rate', () => {
    let game = drawn();
    for (let i = 0; i < 3; i++) game = applyTurnMove(game, 'p1', { type: 'epidemic' });
    // The marker moved from the first 2 to the second 2: still 2 cards.
    expect(game.turn.infectionsLeft).toBe(2);
    const later = atDraw([epidemic, city('lima')]);
    later.infectionRate = 2;
    later.infectionDiscard = ['sydney'];
    let next = applyTurnMove(later, 'p1', { type: 'draw' });
    for (let i = 0; i < 3; i++) next = applyTurnMove(next, 'p1', { type: 'epidemic' });
    expect(next.infectionRate).toBe(3);
    expect(next.turn.infectionsLeft).toBe(3);
  });

  it('tops up a city that already has cubes and outbreaks', () => {
    const game = drawn();
    addCubes(game, 'osaka', 'red', 1);
    let next = applyTurnMove(game, 'p1', { type: 'epidemic' });
    next = applyTurnMove(next, 'p1', { type: 'epidemic' });
    expect(next.cubes.osaka.red).toBe(3);
    expect(next.outbreaks).toBe(1);
    expect(next.cubes.tokyo.red).toBe(1);
  });

  it('keeps the epidemic going after a loss only as game over', () => {
    const game = drawn();
    game.outbreaks = 7;
    addCubes(game, 'osaka', 'red', 3);
    let next = applyTurnMove(game, 'p1', { type: 'epidemic' });
    next = applyTurnMove(next, 'p1', { type: 'epidemic' });
    expect(next.status).toBe('lost');
    expect(next.lossReason).toBe('outbreaks');
  });

  it('resolves two epidemics from one draw, one after the other', () => {
    let game = drawn(2);
    expect(game.hands.p1).toEqual([]);
    expect(game.turn.epidemics).toBe(2);
    for (let i = 0; i < 3; i++) game = applyTurnMove(game, 'p1', { type: 'epidemic' });
    expect(game.turn).toMatchObject({ step: 'epidemic', epidemics: 1, epidemicStep: 'increase' });
    expect(game.infectionRate).toBe(1);
    for (let i = 0; i < 3; i++) game = applyTurnMove(game, 'p1', { type: 'epidemic' });
    expect(game.infectionRate).toBe(2);
    expect(game.turn).toMatchObject({ step: 'infect', epidemics: 0 });
    // The second epidemic's card is the only one reshuffled onto the deck.
    expect(game.infectionDiscard).toEqual([]);
  });

  it('applies the hand limit only after the epidemics are resolved', () => {
    const game = atDraw([epidemic, city('lima')]);
    give(
      game,
      'p1',
      ...(['chicago', 'paris', 'london', 'essen', 'milan', 'madrid', 'tokyo'] as const).map(city),
    );
    let next = applyTurnMove(game, 'p1', { type: 'draw' });
    expect(next.hands.p1).toHaveLength(8);
    expect(next.pending).toBeNull();
    for (let i = 0; i < 3; i++) next = applyTurnMove(next, 'p1', { type: 'epidemic' });
    expect(next.pending).toEqual({ kind: 'discard', seat: 'p1' });
  });

  it('is refused outside the epidemic step', () => {
    expect(why(blankGame(), 'p1', { type: 'epidemic' })).toBe('wrong-step');
  });
});

describe('an empty infection deck', () => {
  it('flips no card and keeps the discard pile', () => {
    const game = blankGame();
    game.turn = { ...game.turn, step: 'infect', infectionsLeft: 2 };
    game.infectionDeck = [];
    game.infectionDiscard = ['tokyo'];
    let next = applyTurnMove(game, 'p1', { type: 'infect' });
    expect(next.infectionDiscard).toEqual(['tokyo']);
    expect(next.cubes.tokyo.red).toBe(0);
    expect(next.turn.infectionsLeft).toBe(1);
    next = applyTurnMove(next, 'p1', { type: 'infect' });
    expect(next.infectionDiscard).toEqual(['tokyo']);
    expect(next.turn.seat).toBe('p2');
  });
});
