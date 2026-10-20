import type { PandemicView, SetupView, TableView } from '@pandemic/rules';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePandemic } from './store';

const playing = (seat: string, actionsLeft: number) =>
  ({
    status: 'playing',
    you: 'p1',
    turn: { seat, actionsLeft },
    log: { current: { seat, entries: [] }, previous: null },
  }) as unknown as PandemicView;

describe('the Pandemic store', () => {
  beforeEach(() => usePandemic.getState().reset());

  it('keeps a selected city while the same turn goes on unchanged', () => {
    usePandemic.getState().selectCity('atlanta');
    const view = playing('p1', 4);
    usePandemic.getState().onView(view, view);
    expect(usePandemic.getState().selectedCity).toBe('atlanta');
  });

  it('clears it when an action is used or the turn moves on', () => {
    usePandemic.getState().selectCity('atlanta');
    usePandemic.getState().onView(playing('p1', 3), playing('p1', 4));
    expect(usePandemic.getState().selectedCity).toBeNull();
    usePandemic.getState().selectCity('paris');
    usePandemic.getState().onView(playing('p2', 4), playing('p1', 0));
    expect(usePandemic.getState().selectedCity).toBeNull();
  });

  it('reset forgets everything', () => {
    usePandemic.getState().selectCity('atlanta');
    usePandemic.getState().reset();
    expect(usePandemic.getState().selectedCity).toBeNull();
  });
});

describe('the deal being played back', () => {
  const setup = { status: 'setup', you: 'p1' } as unknown as SetupView;
  const reduceMotion = (reduce: boolean) =>
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
    }));

  beforeEach(() => {
    usePandemic.getState().reset();
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    reduceMotion(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts when the game turns from the "before the game" step to the dealt board', () => {
    usePandemic.getState().onView(playing('p1', 4), setup as TableView);
    expect(usePandemic.getState().dealStartedAt).toBe(1_000);
    usePandemic.getState().finishDeal();
    expect(usePandemic.getState().dealStartedAt).toBeNull();
  });

  it('does not start for a game opened already dealt, or for a view after the first', () => {
    // A reload or a reconnection: no earlier view.
    usePandemic.getState().onView(playing('p1', 4), null);
    expect(usePandemic.getState().dealStartedAt).toBeNull();
    // The game goes on.
    usePandemic.getState().onView(playing('p1', 3), playing('p1', 4));
    expect(usePandemic.getState().dealStartedAt).toBeNull();
    // Still in the step.
    usePandemic.getState().onView(setup as TableView, setup as TableView);
    expect(usePandemic.getState().dealStartedAt).toBeNull();
  });

  it('is skipped with reduced motion', () => {
    reduceMotion(true);
    usePandemic.getState().onView(playing('p1', 4), setup as TableView);
    expect(usePandemic.getState().dealStartedAt).toBeNull();
  });

  it('is forgotten when the player leaves the game', () => {
    usePandemic.getState().onView(playing('p1', 4), setup as TableView);
    usePandemic.getState().reset();
    expect(usePandemic.getState().dealStartedAt).toBeNull();
  });
});
