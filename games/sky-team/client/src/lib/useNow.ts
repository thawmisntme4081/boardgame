import { useLayoutEffect, useState } from 'react';

/**
 * The current time for a countdown to `until`, refreshed every `intervalMs` until then. With no
 * countdown (`null`) or once it has passed, nothing ticks (and nothing re-renders); a new
 * countdown catches up before painting.
 */
export function useNow(until: number | null, intervalMs = 250): number {
  const [now, setNow] = useState(Date.now);
  useLayoutEffect(() => {
    if (until === null) return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (time >= until) clearInterval(id);
    };
    const id = setInterval(tick, intervalMs);
    tick();
    return () => clearInterval(id);
  }, [until, intervalMs]);
  return now;
}
