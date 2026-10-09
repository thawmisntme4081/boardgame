type Listener = (seconds: number) => void;

const listeners = new Set<Listener>();
let handle = 0;

function loop(now: number) {
  for (const listener of listeners) listener(now / 1000);
  handle = listeners.size > 0 ? requestAnimationFrame(loop) : 0;
}

/**
 * Calls `listener` with the time in seconds on every animation frame, from one shared loop that
 * runs only while someone listens. Returns the function that stops listening.
 */
export function onFrame(listener: Listener): () => void {
  listeners.add(listener);
  listener(0);
  if (!handle) handle = requestAnimationFrame(loop);
  return () => {
    listeners.delete(listener);
  };
}
