type Listener = (seconds: number) => void;

const listeners = new Set<Listener>();
let handle = 0;

/** Whether the player asked for no motion. */
export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function loop(now: number) {
  for (const listener of listeners) listener(now / 1000);
  handle = listeners.size > 0 ? requestAnimationFrame(loop) : 0;
}

/**
 * Calls `listener` with the time in seconds on every animation frame, from one shared loop that
 * runs only while someone listens. With reduced motion it is called once, at time 0, so the
 * picture is drawn but never moves. Returns the function that stops listening.
 */
export function onFrame(listener: Listener): () => void {
  listeners.add(listener);
  listener(0);
  if (!handle && !prefersReducedMotion()) handle = requestAnimationFrame(loop);
  return () => {
    listeners.delete(listener);
  };
}
