import type { PandemicView } from '@pandemic/rules';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePandemic } from './store';

const playing = (seat: string, actionsLeft: number) =>
  ({ status: 'playing', turn: { seat, actionsLeft } }) as unknown as PandemicView;

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
