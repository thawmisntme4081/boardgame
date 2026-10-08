import type { PlatformApi } from '@platform/ui/game';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectPlatform } from './platform';
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

describe("the Flight Log's source", () => {
  const record = { v: 1, scenario: 'yul', seat: 'pilot', result: 'won', at: 5 };
  const connect = (signedIn: boolean, records: unknown[] | null) =>
    connectPlatform({
      signedIn: () => signedIn,
      flightLog: vi.fn().mockResolvedValue(records),
    } as unknown as PlatformApi<never, never>);

  beforeEach(() => localStorage.clear());

  it("shows the account's log from the server when signed in, the device's when not", async () => {
    connect(true, [record, { junk: true }]);
    await useSkyTeam.getState().syncHistory();
    expect(useSkyTeam.getState().history).toEqual([record]);
    connect(false, null);
    await useSkyTeam.getState().syncHistory();
    expect(useSkyTeam.getState().history).toEqual([]);
  });

  it('does not keep a finished game on the device when signed in (the server has it)', async () => {
    connect(true, [record]);
    showView(makeView('pilot'));
    showView(makeView('pilot', { patch: { phase: 'won', round: 7 } }));
    expect(localStorage.getItem('sky-team:history')).toBeNull();
    await vi.waitFor(() => expect(useSkyTeam.getState().history).toEqual([record]));
  });

  it("sends the device's games to the account once, then forgets them", async () => {
    localStorage.setItem('sky-team:history', JSON.stringify([record]));
    const importFlightLog = vi.fn().mockResolvedValue(true);
    connectPlatform({
      signedIn: () => true,
      importFlightLog,
      flightLog: vi.fn().mockResolvedValue([record]),
    } as unknown as PlatformApi<never, never>);
    await useSkyTeam.getState().syncHistory();
    expect(importFlightLog).toHaveBeenCalledWith('sky-team', [record]);
    expect(localStorage.getItem('sky-team:history')).toBeNull();
    await useSkyTeam.getState().syncHistory();
    expect(importFlightLog).toHaveBeenCalledTimes(1);
  });

  it('keeps the device copy when the import fails', async () => {
    localStorage.setItem('sky-team:history', JSON.stringify([record]));
    connectPlatform({
      signedIn: () => true,
      importFlightLog: vi.fn().mockResolvedValue(false),
      flightLog: vi.fn().mockResolvedValue([]),
    } as unknown as PlatformApi<never, never>);
    await useSkyTeam.getState().syncHistory();
    expect(localStorage.getItem('sky-team:history')).not.toBeNull();
  });
});
