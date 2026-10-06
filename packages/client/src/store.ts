import { NEXT_TURN_MS, type PlayerView, type Presence, type SlotId } from '@sky/shared';
import { create } from 'zustand';
import { loadHistory, saveRecord, type GameRecord } from './lib/history';
import { loadSession, type Session } from './session';

export type Connection = 'connecting' | 'online' | 'offline';
export type SiteAccess = 'checking' | 'locked' | 'open';

/**
 * The latest server view plus local UI state. Nothing here decides a rule: moves are
 * checked with the shared `canPlaceInView` and applied only by the server.
 */
export interface GameStore {
  connection: Connection;
  session: Session | null;
  view: PlayerView | null;
  presence: Presence | null;
  /** Presence sent for a seat this client does not show yet: applied with the matching view. */
  pendingPresence: Presence | null;
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
  /** Finished games saved on this device, newest first. */
  history: GameRecord[];
  /** The site password gate: being checked, waiting for the password, or open. */
  siteAccess: SiteAccess;

  setConnection: (connection: Connection) => void;
  setSession: (session: Session | null) => void;
  setView: (view: PlayerView) => void;
  setPresence: (presence: Presence) => void;
  selectDie: (dieId: string | null) => void;
  setCoffeeDelta: (delta: number) => void;
  setInternSlot: (slot: SlotId | null) => void;
  toggleRerollPick: (dieId: string) => void;
  addRecord: (record: GameRecord) => void;
  setSiteAccess: (siteAccess: SiteAccess) => void;
  leave: () => void;
}

export const useGame = create<GameStore>()((set) => ({
  connection: 'connecting',
  session: loadSession(),
  view: null,
  presence: null,
  pendingPresence: null,
  selectedDieId: null,
  coffeeDelta: 0,
  internSlot: null,
  rerollPick: [],
  roundDeadline: null,
  nextTurnAt: null,
  history: loadHistory(),
  siteAccess: 'checking',

  setConnection: (connection) => set({ connection }),
  setSession: (session) => set({ session }),
  setView: (view) =>
    set((s) => {
      const ids = new Set(view.myDice.map((d) => d.id));
      // Synchronization: the co-pilot may be holding the traffic die.
      if (view.bonus && view.seat === 'copilot') ids.add(view.bonus.die.id);
      const keepSelection = s.selectedDieId !== null && ids.has(s.selectedDieId);
      const pending = s.pendingPresence?.you === view.seat ? s.pendingPresence : null;
      return {
        view,
        ...(pending && { presence: pending, pendingPresence: null }),
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
            : s.view && view.round > s.view.round
              ? Date.now() + NEXT_TURN_MS
              : s.nextTurnAt,
      };
    }),
  // Seats can change before round 1: presence for a new seat waits for that seat's view, so
  // "you" and "your partner" never point at the same player for a moment.
  setPresence: (presence) =>
    set((s) =>
      presence.you && s.view && presence.you !== s.view.seat
        ? { pendingPresence: presence }
        : { presence, pendingPresence: null },
    ),
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
  setSiteAccess: (siteAccess) => set({ siteAccess }),
  leave: () =>
    set({
      session: null,
      view: null,
      presence: null,
      pendingPresence: null,
      selectedDieId: null,
      coffeeDelta: 0,
      internSlot: null,
      rerollPick: [],
      roundDeadline: null,
      nextTurnAt: null,
    }),
}));
