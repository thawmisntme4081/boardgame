import { MAP_WIDTH } from './mapGeometry';
import { useSyncExternalStore } from 'react';

/** Width where the wide layout starts: the theme's `wide` breakpoint. */
const WIDE_QUERY = '(min-width: 1200px)';

const subscribe = (notify: () => void) => {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const isWide = () =>
  typeof window.matchMedia === 'function' && window.matchMedia(WIDE_QUERY).matches;

/** True from the `wide` breakpoint (1200px) up. */
export const useWide = (): boolean => useSyncExternalStore(subscribe, isWide, () => false);

const HAND_LIMIT = 7;
const GAP = 6;
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

/** Narrow: 2 rows of 4 cards (the hand limit is 7). Wide: all of them in one row. */
export function handLayout(wide: boolean): HandLayout {
  const columns = wide ? HAND_LIMIT : 4;
  const rows = Math.ceil(HAND_LIMIT / columns);
  const cardHeight = Math.round((CARD_WIDTH * 290) / 208);
  return {
    columns,
    gap: GAP,
    cardWidth: CARD_WIDTH,
    cardHeight,
    mapGap: MAP_GAP,
    left: (MAP_WIDTH - (columns * CARD_WIDTH + (columns - 1) * GAP)) / 2,
    bandHeight: MAP_GAP + rows * cardHeight + (rows - 1) * GAP + GAP,
  };
}
