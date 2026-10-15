import { canPlayCard, type CityId, type SeatId, type TableView } from '@pandemic/rules';
import type { SeatPresence } from '@platform/ui/game';
import { toast } from 'sonner';
import { create } from 'zustand';
import { newEventsOf, type EventPlan } from './lib/events';
import { seatName } from './lib/names';
import { t } from './i18n';

/**
 * Pandemic's own UI state, next to the platform's store (connection, session, the latest view
 * and presence). Nothing here decides a rule: moves are checked with the shared `canActInView`
 * and applied only by the server.
 */
export interface PandemicStore {
  /** City tapped on the board, waiting for the action that uses it. */
  selectedCity: CityId | null;
  selectCity: (city: CityId | null) => void;
  /** The city whose card the pointer is on (in a hand): the map highlights it. */
  hoverCity: CityId | null;
  setHoverCity: (city: CityId | null) => void;
  /** The discard pile whose cards are listed in a dialog (pressed on the map). */
  pile: 'player' | 'infection' | null;
  openPile: (pile: 'player' | 'infection' | null) => void;
  /** The pawn the map moves for a role that moves others' pawns (`null`: your own). */
  movingPawn: SeatId | null;
  setMovingPawn: (pawn: SeatId | null) => void;
  /**
   * When the deal started being shown (the game turned from the "before the game" step to the
   * dealt board in this session), until it is done; `null` otherwise (see `lib/deal.ts`).
   */
  dealStartedAt: number | null;
  finishDeal: () => void;
  /** The event card being played, waiting for its choices (a pawn, a city). */
  eventPlan: EventPlan | null;
  planEvent: (plan: EventPlan | null) => void;
  /**
   * Follows the platform's view: a selection does not outlive its turn or the game, and the
   * events other players play are announced.
   */
  onView: (view: TableView, before: TableView | null, presence?: SeatPresence | null) => void;
  reset: () => void;
}

const seatOf = (view: TableView | null) =>
  view && view.status === 'playing' ? view.turn.seat : null;
const turnOf = (view: TableView | null) =>
  view && view.status === 'playing' ? `${view.turn.seat}:${view.turn.actionsLeft}` : null;

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

export const usePandemic = create<PandemicStore>((set) => ({
  selectedCity: null,
  selectCity: (selectedCity) => set({ selectedCity }),
  pile: null,
  openPile: (pile) => set({ pile }),
  hoverCity: null,
  setHoverCity: (hoverCity) => set({ hoverCity }),
  movingPawn: null,
  setMovingPawn: (movingPawn) => set({ movingPawn, selectedCity: null }),
  dealStartedAt: null,
  finishDeal: () => set({ dealStartedAt: null }),
  eventPlan: null,
  planEvent: (eventPlan) => set({ eventPlan, selectedCity: null }),
  onView: (view, before, presence) => {
    // The deal is played back for a game dealt before our eyes, not for one opened already dealt
    // (a reload, a reconnection); not at all with reduced motion.
    if (before?.status === 'setup' && view.status === 'playing' && !reducedMotion()) {
      set({ dealStartedAt: Date.now() });
    }
    if (turnOf(view) !== turnOf(before)) set({ selectedCity: null });
    if (seatOf(view) !== seatOf(before)) set({ movingPawn: null });
    if (view.status !== 'playing') return;
    // A card you were about to play may no longer be playable (the moment passed).
    const { eventPlan } = usePandemic.getState();
    if (
      eventPlan &&
      (!view.you || !canPlayCard(view, view.you, eventPlan.event, eventPlan.owner))
    ) {
      set({ eventPlan: null });
    }
    if (before?.status !== 'playing') return;
    for (const entry of newEventsOf(view, before)) {
      if (entry.seat === view.you) continue;
      const name = seatName(presence ?? null, entry.seat);
      const event = t(`events.${entry.event}`);
      toast.message(
        entry.owner
          ? t('toast.eventOf', { name, owner: seatName(presence ?? null, entry.owner), event })
          : t(entry.stored ? 'toast.eventStored' : 'toast.event', { name, event }),
      );
    }
  },
  reset: () =>
    set({
      selectedCity: null,
      hoverCity: null,
      movingPawn: null,
      eventPlan: null,
      dealStartedAt: null,
    }),
}));
