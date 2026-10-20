import { useEffect, useState } from 'react';

/**
 * `items` plus the ones that left in the last `ms` milliseconds, marked `leaving`, so a piece can
 * play its exit before it goes. Items are told apart by `keyOf`; an item that comes back stops
 * leaving.
 */
export function useLeaving<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  ms: number,
): { item: T; leaving: boolean }[] {
  const keys = items.map(keyOf).join('|');
  const [before, setBefore] = useState({ keys, items });
  const [ghosts, setGhosts] = useState<{ item: T }[]>([]);

  // Adjusting state while rendering: what is missing now was shown by the render before.
  if (before.keys !== keys) {
    const now = new Set(items.map(keyOf));
    const gone = before.items.filter((item) => !now.has(keyOf(item)));
    setBefore({ keys, items });
    if (gone.length > 0) {
      setGhosts((all) => [...all, ...gone.map((item) => ({ item }))]);
    }
  }

  useEffect(() => {
    if (ghosts.length === 0) return;
    // Each ghost goes `ms` after it appeared: when the list changes, the ones it held are timed.
    const timed = ghosts;
    const timer = setTimeout(() => {
      setGhosts((all) => all.filter((ghost) => !timed.includes(ghost)));
    }, ms);
    return () => clearTimeout(timer);
  }, [ghosts, ms]);

  const here = new Set(items.map(keyOf));
  return [
    ...items.map((item) => ({ item, leaving: false })),
    ...ghosts.filter((g) => !here.has(keyOf(g.item))).map((g) => ({ item: g.item, leaving: true })),
  ];
}
