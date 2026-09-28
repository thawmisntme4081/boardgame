import type { PlayerView, Presence } from '@sky/shared';
import { create } from 'zustand';
import { loadSession, type Session } from './session';

export type Connection = 'connecting' | 'online' | 'offline';

/**
 * The latest server view plus local UI state. Nothing here decides a rule: moves are
 * checked with the shared `canPlaceInView` and applied only by the server.
 */
export interface GameStore {
  connection: Connection;
  session: Session | null;
  view: PlayerView | null;
  presence: Presence | null;
  /** Die tapped in the tray, waiting for a slot. */
  selectedDieId: string | null;
  /** Draft coffee modifier for the selected die; sent with the move. */
  coffeeDelta: number;
  /** Dice ticked for a reroll. */
  rerollPick: string[];

  setConnection: (connection: Connection) => void;
  setSession: (session: Session | null) => void;
  setView: (view: PlayerView) => void;
  setPresence: (presence: Presence) => void;
  selectDie: (dieId: string | null) => void;
  setCoffeeDelta: (delta: number) => void;
  toggleRerollPick: (dieId: string) => void;
  leave: () => void;
}

export const useGame = create<GameStore>()((set) => ({
  connection: 'connecting',
  session: loadSession(),
  view: null,
  presence: null,
  selectedDieId: null,
  coffeeDelta: 0,
  rerollPick: [],

  setConnection: (connection) => set({ connection }),
  setSession: (session) => set({ session }),
  setView: (view) =>
    set((s) => {
      const ids = new Set(view.myDice.map((d) => d.id));
      const keepSelection = s.selectedDieId !== null && ids.has(s.selectedDieId);
      return {
        view,
        // A placed or rerolled-away die can't stay selected; coffee may have changed too.
        selectedDieId: keepSelection ? s.selectedDieId : null,
        coffeeDelta: keepSelection && view.coffee >= Math.abs(s.coffeeDelta) ? s.coffeeDelta : 0,
        rerollPick: view.rerollPending[view.seat] ? s.rerollPick.filter((id) => ids.has(id)) : [],
      };
    }),
  setPresence: (presence) => set({ presence }),
  selectDie: (dieId) =>
    set((s) => ({
      selectedDieId: s.selectedDieId === dieId ? null : dieId,
      coffeeDelta: 0,
    })),
  setCoffeeDelta: (coffeeDelta) => set({ coffeeDelta }),
  toggleRerollPick: (dieId) =>
    set((s) => ({
      rerollPick: s.rerollPick.includes(dieId)
        ? s.rerollPick.filter((id) => id !== dieId)
        : [...s.rerollPick, dieId],
    })),
  leave: () =>
    set({
      session: null,
      view: null,
      presence: null,
      selectedDieId: null,
      coffeeDelta: 0,
      rerollPick: [],
    }),
}));
