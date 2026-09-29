import { useEffect, useState } from 'react';

/** The current time, refreshed every `intervalMs`: drives on-screen countdowns. */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
