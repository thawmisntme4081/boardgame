import type { DieValue } from '@sky/rules';
import { useEffect, useState } from 'react';

/** How long a die "rolls" (random faces) before it shows its value. */
export const ROLL_MS = 1000;
const FACE_MS = 80;

const randomFace = () => (Math.floor(Math.random() * 6) + 1) as DieValue;

/**
 * The face to draw for a die that was just rolled: random faces for `ROLL_MS`, then `value`.
 * It rolls once, when the die appears (the tray gives a rerolled die a new key) and `animate`
 * is true; a later change of `value` (coffee) shows at once. Display only.
 */
export function useRolledValue(value: DieValue, animate = true): DieValue {
  // `animate` counts when the die appears: a die that was not rolled never shows random faces.
  const [shown, setShown] = useState<DieValue>(() => (animate ? randomFace() : value));
  const [rolling, setRolling] = useState(animate);

  useEffect(() => {
    if (!rolling) return;
    const tick = setInterval(() => setShown(randomFace()), FACE_MS);
    const stop = setTimeout(() => setRolling(false), ROLL_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(stop);
    };
  }, [rolling]);

  return rolling ? shown : value;
}
