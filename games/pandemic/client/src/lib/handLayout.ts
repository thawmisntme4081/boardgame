import { MAP_WIDTH } from './mapGeometry';
import { useSyncExternalStore } from 'react';

/** Where the wide hand layout starts: Tailwind's `xl` breakpoint (1280px). */
const WIDE_QUERY = '(min-width: 1280px)';

const subscribe = (notify: () => void) => {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const isWide = () =>
  typeof window.matchMedia === 'function' && window.matchMedia(WIDE_QUERY).matches;

/** True from the `xl` breakpoint up. */
export const useWide = (): boolean => useSyncExternalStore(subscribe, isWide, () => false);

/** The most cards a hand holds: the limit of 7, plus the 2 just drawn (or a shared one) before it is discarded down. */
const MAX_HAND = 9;
const GAP = 6;
/** Card width where the cards are in two rows. */
const CARD_WIDTH = 130;
/** Space between the map and the first row. */
const MAP_GAP = 16;

/** Where your hand sits under the map; the pictures are 208x290. */
export interface HandLayout {
  columns: number;
  gap: number;
  cardWidth: number;
  cardHeight: number;
  mapGap: number;
  /** Left edge of the rows, which are centered under the map. */
  left: number;
  /** Height of the whole band below the map. */
  bandHeight: number;
}

/**
 * Narrow: 2 rows (5 and 4 cards). Wide (`xl` and up): all 9 in one row, the cards as wide as the
 * map allows, so the band is shorter and the map taller.
 */
export function handLayout(wide: boolean): HandLayout {
  const columns = wide ? MAX_HAND : Math.ceil(MAX_HAND / 2);
  const rows = Math.ceil(MAX_HAND / columns);
  const cardWidth = wide ? Math.floor((MAP_WIDTH - (columns - 1) * GAP) / columns) : CARD_WIDTH;
  const cardHeight = Math.round((cardWidth * 290) / 208);
  return {
    columns,
    gap: GAP,
    cardWidth,
    cardHeight,
    mapGap: MAP_GAP,
    left: (MAP_WIDTH - (columns * cardWidth + (columns - 1) * GAP)) / 2,
    bandHeight: MAP_GAP + rows * cardHeight + (rows - 1) * GAP + GAP,
  };
}
