import { beforeEach, describe, expect, it } from 'vitest';
import { useGame } from './store';
import { makeView, presence, resetStore } from './test/fixtures';

beforeEach(resetStore);

describe('game store', () => {
  it('toggles the selected die and resets its coffee', () => {
    const { selectDie, setCoffeeDelta } = useGame.getState();
    selectDie('p1');
    setCoffeeDelta(1);
    expect(useGame.getState()).toMatchObject({ selectedDieId: 'p1', coffeeDelta: 1 });
    selectDie('p2');
    expect(useGame.getState()).toMatchObject({ selectedDieId: 'p2', coffeeDelta: 0 });
    selectDie('p2');
    expect(useGame.getState().selectedDieId).toBeNull();
  });

  it('keeps the selection when a new view still has the die', () => {
    useGame.setState({ selectedDieId: 'p2', coffeeDelta: 1 });
    useGame.getState().setView(makeView('pilot', { patch: { coffee: 2 } }));
    expect(useGame.getState()).toMatchObject({ selectedDieId: 'p2', coffeeDelta: 1 });
  });

  it('drops the selection once the die is gone, and coffee that is no longer there', () => {
    useGame.setState({ selectedDieId: 'p9', coffeeDelta: 1 });
    useGame.getState().setView(makeView('pilot'));
    expect(useGame.getState()).toMatchObject({ selectedDieId: null, coffeeDelta: 0 });

    useGame.setState({ selectedDieId: 'p1', coffeeDelta: 2 });
    useGame.getState().setView(makeView('pilot', { patch: { coffee: 1 } }));
    expect(useGame.getState()).toMatchObject({ selectedDieId: 'p1', coffeeDelta: 0 });
  });

  it('keeps reroll picks only while a reroll is pending', () => {
    useGame.setState({ rerollPick: ['p1', 'p9'] });
    const pending = makeView('pilot', { patch: { rerollPending: { pilot: true, copilot: true } } });
    useGame.getState().setView(pending);
    expect(useGame.getState().rerollPick).toEqual(['p1']);
    useGame.getState().setView(makeView('pilot'));
    expect(useGame.getState().rerollPick).toEqual([]);
  });

  it('clears the game and selection on leave', () => {
    useGame.setState({ view: makeView('pilot'), selectedDieId: 'p1', rerollPick: ['p2'] });
    useGame.getState().leave();
    expect(useGame.getState()).toMatchObject({
      session: null,
      view: null,
      presence: null,
      selectedDieId: null,
      rerollPick: [],
    });
  });
});

describe('presence across a seat change', () => {
  it('waits for the view of the new seat before showing the new presence', () => {
    const before = presence();
    // Ana created the game as the pilot, then took the co-pilot seat.
    const swapped = { pilot: before.copilot, copilot: before.pilot, you: 'copilot' as const };
    useGame.getState().setView(makeView('pilot', { rolled: false, patch: { phase: 'setup' } }));
    useGame.getState().setPresence({ ...before, you: 'pilot' });

    useGame.getState().setPresence(swapped);
    // Still the pilot's view: the old presence stays, so the partner is still Ben.
    expect(useGame.getState().presence?.copilot?.name).toBe('Ben');

    useGame.getState().setView(makeView('copilot', { rolled: false, patch: { phase: 'setup' } }));
    expect(useGame.getState().presence).toBe(swapped);
    expect(useGame.getState().presence?.pilot?.name).toBe('Ben');
  });
});
