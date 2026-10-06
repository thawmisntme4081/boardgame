import { beforeEach, describe, expect, it } from 'vitest';
import { useSkyTeam } from './store';
import { makeView, resetStore, showView } from './test/fixtures';

beforeEach(resetStore);

describe("Sky Team's store", () => {
  it('toggles the selected die and resets its coffee', () => {
    const { selectDie, setCoffeeDelta } = useSkyTeam.getState();
    selectDie('p1');
    setCoffeeDelta(1);
    expect(useSkyTeam.getState()).toMatchObject({ selectedDieId: 'p1', coffeeDelta: 1 });
    selectDie('p2');
    expect(useSkyTeam.getState()).toMatchObject({ selectedDieId: 'p2', coffeeDelta: 0 });
    selectDie('p2');
    expect(useSkyTeam.getState().selectedDieId).toBeNull();
  });

  it('keeps the selection when a new view still has the die', () => {
    useSkyTeam.setState({ selectedDieId: 'p2', coffeeDelta: 1 });
    showView(makeView('pilot', { patch: { coffee: 2 } }));
    expect(useSkyTeam.getState()).toMatchObject({ selectedDieId: 'p2', coffeeDelta: 1 });
  });

  it('drops the selection once the die is gone, and coffee that is no longer there', () => {
    useSkyTeam.setState({ selectedDieId: 'p9', coffeeDelta: 1 });
    showView(makeView('pilot'));
    expect(useSkyTeam.getState()).toMatchObject({ selectedDieId: null, coffeeDelta: 0 });

    useSkyTeam.setState({ selectedDieId: 'p1', coffeeDelta: 2 });
    showView(makeView('pilot', { patch: { coffee: 1 } }));
    expect(useSkyTeam.getState()).toMatchObject({ selectedDieId: 'p1', coffeeDelta: 0 });
  });

  it('keeps reroll picks only while a reroll is pending', () => {
    useSkyTeam.setState({ rerollPick: ['p1', 'p9'] });
    showView(makeView('pilot', { patch: { rerollPending: { pilot: true, copilot: true } } }));
    expect(useSkyTeam.getState().rerollPick).toEqual(['p1']);
    showView(makeView('pilot'));
    expect(useSkyTeam.getState().rerollPick).toEqual([]);
  });

  it('forgets the selection when the player leaves the room', () => {
    useSkyTeam.setState({ selectedDieId: 'p1', rerollPick: ['p2'], coffeeDelta: 1 });
    useSkyTeam.getState().reset();
    expect(useSkyTeam.getState()).toMatchObject({
      selectedDieId: null,
      rerollPick: [],
      coffeeDelta: 0,
    });
  });
});
