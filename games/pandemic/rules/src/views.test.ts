import { describe, expect, it } from 'vitest';
import { pandemic } from './definition';
import { viewFor } from './views';
import type { GameState } from './types';

const game = (seed: number): GameState =>
  pandemic.setup({
    config: { players: 3, epidemics: 5 },
    seats: ['p1', 'p2', 'p3'],
    host: 'p1',
    seed,
  });

describe('views', () => {
  it('show every hand to every seat, and to a spectator', () => {
    const state = game(1);
    for (const viewer of ['p1', 'p2', 'p3', 'spectator']) {
      const view = viewFor(state, viewer);
      expect(view.hands).toEqual(state.hands);
    }
    expect(viewFor(state, 'p2').you).toBe('p2');
    expect(viewFor(state, 'spectator').you).toBeNull();
  });

  it('show both discard piles and the deck sizes', () => {
    const state = game(1);
    const view = viewFor(state, 'p1');
    expect(view.infectionDiscard).toEqual(state.infectionDiscard);
    expect(view.playerDiscard).toEqual(state.playerDiscard);
    expect(view.infectionDeckSize).toBe(39);
    expect(view.playerDeckSize).toBe(state.playerDeck.length);
  });

  it('hold no deck, no seed and no RNG state', () => {
    const json = JSON.stringify(viewFor(game(1), 'p1'));
    for (const key of ['playerDeck"', 'infectionDeck"', 'rngSeed', 'rngState']) {
      expect(json).not.toContain(key);
    }
  });

  it('do not change when only the order of the decks or the seed changes', () => {
    const a = game(1);
    const b = structuredClone(a);
    b.playerDeck.reverse();
    b.infectionDeck.reverse();
    b.rngSeed = 999;
    b.rngState = 12345;
    expect(viewFor(b, 'p1')).toEqual(viewFor(a, 'p1'));
  });

  it('do not change when the epidemics sit in other places of the deck', () => {
    const a = game(2);
    const b = structuredClone(a);
    const epidemics = b.playerDeck.filter((card) => card.kind === 'epidemic');
    b.playerDeck = [...epidemics, ...b.playerDeck.filter((card) => card.kind !== 'epidemic')];
    expect(viewFor(b, 'p3')).toEqual(viewFor(a, 'p3'));
  });

  it('are copies: changing a view never changes the game', () => {
    const state = game(1);
    const view = viewFor(state, 'p1');
    view.cubes.atlanta.blue = 3;
    view.hands.p1?.pop();
    expect(state.cubes.atlanta.blue).toBe(0);
    expect(state.hands.p1).toHaveLength(3);
  });
});
