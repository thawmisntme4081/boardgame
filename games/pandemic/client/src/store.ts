import type { CityId, SeatId, TableView } from '@pandemic/rules';
import { create } from 'zustand';

/**
 * Pandemic's own UI state, next to the platform's store (connection, session, the latest view
 * and presence). Nothing here decides a rule: moves are checked with the shared `canActInView`
 * and applied only by the server.
 */
export interface PandemicStore {
  /** City tapped on the board, waiting for the action that uses it. */
  selectedCity: CityId | null;
  selectCity: (city: CityId | null) => void;
  /** The pawn the map moves for a role that moves others' pawns (`null`: your own). */
  movingPawn: SeatId | null;
  setMovingPawn: (pawn: SeatId | null) => void;
  /** Follows the platform's view: a selection does not outlive its turn or the game. */
  onView: (view: TableView, before: TableView | null) => void;
  reset: () => void;
}

const seatOf = (view: TableView | null) =>
  view && view.status === 'playing' ? view.turn.seat : null;
const turnOf = (view: TableView | null) =>
  view && view.status === 'playing' ? `${view.turn.seat}:${view.turn.actionsLeft}` : null;

export const usePandemic = create<PandemicStore>((set) => ({
  selectedCity: null,
  selectCity: (selectedCity) => set({ selectedCity }),
  movingPawn: null,
  setMovingPawn: (movingPawn) => set({ movingPawn, selectedCity: null }),
  onView: (view, before) => {
    if (turnOf(view) !== turnOf(before)) set({ selectedCity: null });
    if (seatOf(view) !== seatOf(before)) set({ movingPawn: null });
  },
  reset: () => set({ selectedCity: null, movingPawn: null }),
}));
