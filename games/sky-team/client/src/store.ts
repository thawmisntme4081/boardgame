import { isGameOver, NEXT_TURN_MS, type PlayerView, type Presence, type SlotId } from '@sky/rules';
import { create } from 'zustand';
import {
  clearHistory,
  isRecord,
  loadHistory,
  recordFor,
  saveRecord,
  type GameRecord,
} from './lib/history';
import { NS } from './i18n';
import { platform, signedIn } from './platform';

/**
 * Sky Team's own UI state, next to the platform's store (connection, session, the latest view
 * and presence). Nothing here decides a rule: moves are checked with the shared
 * `canPlaceInView` and applied only by the server.
 */
export interface SkyTeamStore {
  /** Die tapped in the tray, waiting for a slot. */
  selectedDieId: string | null;
  /** Draft coffee modifier for the selected die; sent with the move. */
  coffeeDelta: number;
  /** Intern: the Intern space tapped for the selected die; the next tap places the token. */
  internSlot: SlotId | null;
  /** Dice ticked for a reroll. */
  rerollPick: string[];
  /**
   * Timed games: when this round's time runs out, on this device's clock (set from the
   * view's time left when it arrives), or `null`.
   */
  roundDeadline: number | null;
  /** When the green "Next turn in 5s" after a round's last die ends (this device's clock). */
  nextTurnAt: number | null;
  /** Finished games saved on this device (the Flight Log), newest first. */
  history: GameRecord[];

  /** A new view arrived (`before`: the last one shown, if any). */
  onView: (view: PlayerView, before: PlayerView | null, presence: Presence | null) => void;
  selectDie: (dieId: string | null) => void;
  setCoffeeDelta: (delta: number) => void;
  setInternSlot: (slot: SlotId | null) => void;
  toggleRerollPick: (dieId: string) => void;
  addRecord: (record: GameRecord) => void;
  /** Shows the right Flight Log: the account's (from the server) when signed in, else the device's. */
  syncHistory: () => Promise<void>;
  /** Left the room: nothing of the old game stays selected. */
  reset: () => void;
}

const fresh = {
  selectedDieId: null,
  coffeeDelta: 0,
  internSlot: null,
  rerollPick: [],
  roundDeadline: null,
  nextTurnAt: null,
};

export const useSkyTeam = create<SkyTeamStore>()((set, get) => ({
  ...fresh,
  history: loadHistory(),

  onView: (view, before, presence) => {
    set((s) => {
      const ids = new Set(view.myDice.map((d) => d.id));
      // Synchronization: the co-pilot may be holding the traffic die.
      if (view.bonus && view.seat === 'copilot') ids.add(view.bonus.die.id);
      const keepSelection = s.selectedDieId !== null && ids.has(s.selectedDieId);
      // A game that just ended goes into this device's Flight Log (once).
      const record = recordFor(before, view, presence, Date.now());
      return {
        // A placed or rerolled-away die can't stay selected; coffee may have changed too.
        selectedDieId: keepSelection ? s.selectedDieId : null,
        coffeeDelta: keepSelection && view.coffee >= Math.abs(s.coffeeDelta) ? s.coffeeDelta : 0,
        internSlot: keepSelection && view.phase === 'placing' ? s.internSlot : null,
        rerollPick: view.rerollPending[view.seat] ? s.rerollPick.filter((id) => ids.has(id)) : [],
        roundDeadline: view.roundTimeLeftMs === null ? null : Date.now() + view.roundTimeLeftMs,
        // The round's last die was just placed and the game goes on: a 5 s breather.
        nextTurnAt:
          view.phase !== 'strategy'
            ? null
            : before && view.round > before.round
              ? Date.now() + NEXT_TURN_MS
              : s.nextTurnAt,
        // Signed in, the server keeps the game in the account's log; guests keep it here.
        ...(record && !signedIn() && { history: saveRecord(record) }),
      };
    });
    // The server wrote the account's entry before this view was sent.
    if (before && signedIn() && isGameOver(view) && !isGameOver(before)) void get().syncHistory();
  },
  selectDie: (dieId) =>
    set((s) => ({
      selectedDieId: s.selectedDieId === dieId ? null : dieId,
      coffeeDelta: 0,
      internSlot: null,
    })),
  setCoffeeDelta: (coffeeDelta) => set({ coffeeDelta, internSlot: null }),
  setInternSlot: (internSlot) => set({ internSlot }),
  toggleRerollPick: (dieId) =>
    set((s) => ({
      rerollPick: s.rerollPick.includes(dieId)
        ? s.rerollPick.filter((id) => id !== dieId)
        : [...s.rerollPick, dieId],
    })),
  addRecord: (record) => set({ history: saveRecord(record) }),
  syncHistory: async () => {
    if (!signedIn()) return void set({ history: loadHistory() });
    // First time signed in on this device: its games go to the account, then the copy goes.
    const local = loadHistory();
    if (local.length > 0 && (await platform().importFlightLog(NS, local))) clearHistory();
    const records = await platform().flightLog(NS);
    if (records && signedIn()) set({ history: records.filter(isRecord) });
  },
  reset: () => set(fresh),
}));
