// "Restart turn": the active player takes back everything done this turn until the draw.
import { describe, expect, it } from 'vitest';
import { applyMove, checkMove, type PandemicMove } from './moves';
import { blankGame, city, give } from './test-utils';
import { viewFor } from './views';
import type { GameState } from './types';

const restart: PandemicMove = { type: 'restart-turn' };
const reason = (game: GameState, seat: 'p1' | 'p2' | 'p3', move: PandemicMove) => {
  const check = checkMove(game, seat, move);
  return check.ok ? 'ok' : check.reason;
};
/** The game without its checkpoint, to compare two games. */
const plain = (game: GameState) => ({ ...game, checkpoint: null });

describe('Restart turn', () => {
  it('is not possible before the turn has started (nothing done yet)', () => {
    const game = blankGame(3);
    expect(game.checkpoint).toBeNull();
    expect(reason(game, 'p1', restart)).toBe('cannot-restart');
  });

  it('takes back an action, and cannot be done twice in a row', () => {
    const game = blankGame(3);
    const moved = applyMove(game, 'p1', { type: 'drive', to: 'chicago' });
    expect(moved.pawns.p1).toBe('chicago');
    expect(moved.turn.actionsLeft).toBe(3);
    expect(reason(moved, 'p1', restart)).toBe('ok');

    const back = applyMove(moved, 'p1', restart);
    expect(plain(back)).toEqual(plain(game));
    expect(back.checkpoint).toBeNull();
    expect(reason(back, 'p1', restart)).toBe('cannot-restart');
  });

  it('takes back all four actions, up to the moment before the draw', () => {
    let game = blankGame(3);
    const start = structuredClone(game);
    for (const to of ['chicago', 'montreal', 'new-york', 'washington'] as const) {
      game = applyMove(game, 'p1', { type: 'drive', to });
    }
    expect(game.turn.step).toBe('draw');
    expect(reason(game, 'p1', restart)).toBe('ok');
    expect(plain(applyMove(game, 'p1', restart))).toEqual(plain(start));
  });

  it('takes back Pass', () => {
    const game = blankGame(3);
    const passed = applyMove(game, 'p1', { type: 'pass' });
    expect(passed.turn.step).toBe('draw');
    const back = applyMove(passed, 'p1', restart);
    expect(back.turn.step).toBe('actions');
    expect(back.turn.actionsLeft).toBe(4);
  });

  it('is not possible once the cards are drawn', () => {
    const passed = applyMove(blankGame(3), 'p1', { type: 'pass' });
    const drawn = applyMove(passed, 'p1', { type: 'draw' });
    expect(drawn.checkpoint).toBeNull();
    expect(reason(drawn, 'p1', restart)).toBe('cannot-restart');
  });

  it('is only for the active player', () => {
    const moved = applyMove(blankGame(3), 'p1', { type: 'drive', to: 'chicago' });
    expect(reason(moved, 'p2', restart)).toBe('not-your-turn');
  });

  it('is not possible while an offer waits for its answer', () => {
    const game = blankGame(3);
    give(game, 'p1', city('atlanta'));
    game.pawns.p2 = 'atlanta';
    const offered = applyMove(game, 'p1', {
      type: 'share-offer',
      direction: 'give',
      with: 'p2',
      city: 'atlanta',
    });
    expect(offered.pending).not.toBeNull();
    expect(reason(offered, 'p1', restart)).toBe('cannot-restart');
  });

  it('takes back an accepted Share Knowledge, cards of both players included', () => {
    const game = blankGame(3);
    give(game, 'p1', city('atlanta'));
    game.pawns.p2 = 'atlanta';
    let next = applyMove(game, 'p1', {
      type: 'share-offer',
      direction: 'give',
      with: 'p2',
      city: 'atlanta',
    });
    next = applyMove(next, 'p2', { type: 'share-accept' });
    expect(next.hands.p2).toHaveLength(1);
    const back = applyMove(next, 'p1', restart);
    expect(back.hands.p1).toHaveLength(1);
    expect(back.hands.p2).toHaveLength(0);
  });

  it('takes back an event the active player played', () => {
    const game = blankGame(3);
    give(game, 'p1', { kind: 'event', event: 'government-grant' });
    const played = applyMove(game, 'p1', {
      type: 'play-event',
      event: 'government-grant',
      city: 'tokyo',
    });
    expect(played.stations).toContain('tokyo');
    expect(played.hands.p1).toHaveLength(0);
    const back = applyMove(played, 'p1', restart);
    expect(back.stations).not.toContain('tokyo');
    expect(back.hands.p1).toEqual([{ kind: 'event', event: 'government-grant' }]);
  });

  it('is not possible once another player played an event during the turn', () => {
    const game = blankGame(3);
    give(game, 'p2', { kind: 'event', event: 'one-quiet-night' });
    const moved = applyMove(game, 'p1', { type: 'drive', to: 'chicago' });
    expect(reason(moved, 'p1', restart)).toBe('ok');
    const theirs = applyMove(moved, 'p2', { type: 'play-event', event: 'one-quiet-night' });
    expect(reason(theirs, 'p1', restart)).toBe('cannot-restart');
  });

  it('is told to the client by the view, which never carries the checkpoint', () => {
    const game = blankGame(3);
    expect(viewFor(game, 'p1').restartable).toBe(false);
    const moved = applyMove(game, 'p1', { type: 'drive', to: 'chicago' });
    const view = viewFor(moved, 'p1');
    expect(view.restartable).toBe(true);
    expect(JSON.stringify(view)).not.toContain('checkpoint');
    expect(JSON.stringify(viewFor(moved, 'spectator'))).not.toContain('checkpoint');
  });

  it('starts a new checkpoint for the next turn', () => {
    let game = blankGame(3);
    game = applyMove(game, 'p1', { type: 'pass' });
    game = applyMove(game, 'p1', { type: 'draw' });
    // The draws and infections of p1's turn are done by the moves below.
    for (let i = 0; i < 20 && game.turn.seat === 'p1' && game.status === 'playing'; i++) {
      const step = game.turn.step;
      game = applyMove(game, 'p1', {
        type: step === 'epidemic' ? 'epidemic' : 'infect',
      } as PandemicMove);
    }
    expect(game.turn.seat).toBe('p2');
    expect(game.checkpoint).toBeNull();
    const moved = applyMove(game, 'p2', { type: 'pass' });
    expect(moved.checkpoint).not.toBeNull();
  });
});
