import { describe, expect, it } from 'vitest';
import { applyAction } from './actions';
import { createGame } from './setup';
import { outcome } from './outcome';
import { addCubes, blankGame, city, give } from './test-utils';
import { applyTurnMove } from './turn';

describe('outcome', () => {
  it('is null while the game is played', () => {
    expect(outcome(createGame({ seats: ['p1', 'p2'], epidemics: 4, seed: 1 }))).toBeNull();
  });

  it('is a win with the fourth cure', () => {
    const game = blankGame();
    game.cures.yellow = 'cured';
    game.cures.black = 'cured';
    game.cures.red = 'cured';
    const blue = ['chicago', 'london', 'essen', 'milan', 'paris'] as const;
    give(game, 'p1', ...blue.map(city));
    const won = applyAction(game, 'p1', { type: 'cure', color: 'blue', cards: [...blue] });
    expect(outcome(won)).toEqual({ kind: 'coop', won: true, reasons: [] });
  });

  it('is a loss by outbreaks: the 8th outbreak during the infect step', () => {
    let game = blankGame();
    game.turn.step = 'draw';
    game.playerDeck = [city('lima'), city('cairo'), city('paris')];
    game.infectionDeck = ['atlanta'];
    game.outbreaks = 7;
    addCubes(game, 'atlanta', 'blue', 3);
    game = applyTurnMove(game, 'p1', { type: 'draw' });
    expect(outcome(game)).toBeNull();
    game = applyTurnMove(game, 'p1', { type: 'infect' });
    expect(outcome(game)).toEqual({ kind: 'coop', won: false, reasons: ['outbreaks'] });
  });

  it('is a loss by cubes: an epidemic with too few cubes left', () => {
    let game = blankGame();
    game.turn.step = 'draw';
    game.playerDeck = [{ kind: 'epidemic' }, city('lima'), city('cairo')];
    game.infectionDeck = ['tokyo', 'osaka'];
    game.supply.red = 2;
    game = applyTurnMove(game, 'p1', { type: 'draw' });
    for (let i = 0; i < 2; i++) game = applyTurnMove(game, 'p1', { type: 'epidemic' });
    expect(outcome(game)).toEqual({ kind: 'coop', won: false, reasons: ['cubes'] });
  });

  it('is a loss by the player deck: fewer than 2 cards to draw', () => {
    let game = blankGame();
    game.turn.step = 'draw';
    game.playerDeck = [city('lima')];
    game = applyTurnMove(game, 'p1', { type: 'draw' });
    expect(outcome(game)).toEqual({ kind: 'coop', won: false, reasons: ['player-deck'] });
  });

  it('refuses every move once the game is over', () => {
    let game = blankGame();
    game.turn.step = 'draw';
    game.playerDeck = [];
    game = applyTurnMove(game, 'p1', { type: 'draw' });
    expect(() => applyAction(game, 'p1', { type: 'pass' })).toThrow();
    expect(() => applyTurnMove(game, 'p1', { type: 'draw' })).toThrow();
  });
});
