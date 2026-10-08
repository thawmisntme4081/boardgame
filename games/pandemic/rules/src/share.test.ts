import { describe, expect, it } from 'vitest';
import type { ActionReason } from './actions';
import { applyShare, checkShare, shareAnswerer, type ShareMove } from './share';
import { blankGame, city, give } from './test-utils';
import type { GameState, SeatId } from './types';

const why = (game: GameState, seat: SeatId, move: ShareMove): ActionReason | 'ok' => {
  const check = checkShare(game, seat, move);
  return check.ok ? 'ok' : check.reason;
};

const give1: ShareMove = { type: 'share-offer', direction: 'give', with: 'p2' };
const take1: ShareMove = { type: 'share-offer', direction: 'take', with: 'p2' };

describe('Share Knowledge', () => {
  it('opens an offer to give, and moves the card only when the partner accepts', () => {
    const game = blankGame();
    give(game, 'p1', city('atlanta'));
    const offered = applyShare(game, 'p1', give1);
    expect(offered.pending).toEqual({ kind: 'share', from: 'p1', to: 'p2', city: 'atlanta' });
    expect(offered.turn.actionsLeft).toBe(4);
    expect(offered.hands.p1).toEqual([city('atlanta')]);
    expect(shareAnswerer(offered)).toBe('p2');

    const done = applyShare(offered, 'p2', { type: 'share-accept' });
    expect(done.pending).toBeNull();
    expect(done.hands.p1).toEqual([]);
    expect(done.hands.p2).toEqual([city('atlanta')]);
    expect(done.turn.actionsLeft).toBe(3);
  });

  it('opens an offer to take the card from the partner', () => {
    const game = blankGame();
    give(game, 'p2', city('atlanta'));
    const offered = applyShare(game, 'p1', take1);
    expect(offered.pending).toEqual({ kind: 'share', from: 'p2', to: 'p1', city: 'atlanta' });
    expect(shareAnswerer(offered)).toBe('p2');
    const done = applyShare(offered, 'p2', { type: 'share-accept' });
    expect(done.hands.p1).toEqual([city('atlanta')]);
    expect(done.hands.p2).toEqual([]);
  });

  it('spends no action when the partner declines or the active player cancels', () => {
    const game = blankGame();
    give(game, 'p1', city('atlanta'));
    const offered = applyShare(game, 'p1', give1);
    for (const [seat, move] of [
      ['p2', { type: 'share-decline' }],
      ['p1', { type: 'share-cancel' }],
    ] as const) {
      const next = applyShare(offered, seat, move);
      expect(next.pending).toBeNull();
      expect(next.turn.actionsLeft).toBe(4);
      expect(next.hands.p1).toEqual([city('atlanta')]);
    }
  });

  it('only lets the right seat answer', () => {
    const game = blankGame();
    give(game, 'p1', city('atlanta'));
    const offered = applyShare(game, 'p1', give1);
    expect(why(offered, 'p1', { type: 'share-accept' })).toBe('not-your-answer');
    expect(why(offered, 'p1', { type: 'share-decline' })).toBe('not-your-answer');
    expect(why(offered, 'p2', { type: 'share-cancel' })).toBe('not-your-turn');
    expect(why(game, 'p2', { type: 'share-accept' })).toBe('no-offer');
  });

  it('blocks every other action while an offer is open', () => {
    const game = blankGame();
    give(game, 'p1', city('atlanta'));
    const offered = applyShare(game, 'p1', give1);
    expect(why(offered, 'p1', give1)).toBe('answer-first');
  });

  it('needs the same city, the card of that city and a real partner', () => {
    const game = blankGame();
    expect(why(game, 'p1', give1)).toBe('card-missing');
    give(game, 'p1', city('chicago'));
    expect(why(game, 'p1', give1)).toBe('card-missing');
    game.pawns.p2 = 'chicago';
    expect(why(game, 'p1', give1)).toBe('not-together');
    expect(why(game, 'p1', { ...give1, with: 'p1' })).toBe('bad-partner');
    expect(why(game, 'p1', { ...give1, with: 'p3' })).toBe('bad-partner');
    expect(why(game, 'p2', give1)).toBe('not-your-turn');
  });

  it('refuses an offer outside the actions step or with no actions left', () => {
    const game = blankGame();
    give(game, 'p1', city('atlanta'));
    expect(why({ ...game, turn: { ...game.turn, step: 'draw' } }, 'p1', give1)).toBe('wrong-step');
    expect(why({ ...game, turn: { ...game.turn, actionsLeft: 0 } }, 'p1', give1)).toBe(
      'no-actions-left',
    );
  });

  it('makes a receiver with more than 7 cards owe a discard', () => {
    const game = blankGame();
    give(game, 'p1', city('atlanta'));
    for (const c of ['chicago', 'paris', 'london', 'essen', 'milan', 'madrid', 'tokyo'] as const) {
      give(game, 'p2', city(c));
    }
    const done = applyShare(applyShare(game, 'p1', give1), 'p2', { type: 'share-accept' });
    expect(done.hands.p2).toHaveLength(8);
    expect(done.pending).toEqual({ kind: 'discard', seat: 'p2' });
  });

  it('ends the actions part of the turn when it spends the last action', () => {
    const game = blankGame();
    game.turn.actionsLeft = 1;
    give(game, 'p1', city('atlanta'));
    const done = applyShare(applyShare(game, 'p1', give1), 'p2', { type: 'share-accept' });
    expect(done.turn).toMatchObject({ actionsLeft: 0, step: 'draw' });
  });
});
