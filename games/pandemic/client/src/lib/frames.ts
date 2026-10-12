type Listener = (seconds: number) => void;

const listeners = new Set<Listener>();
let handle = 0;
let last = -Infinity;

/** About 30 frames a second: the cubes turn slowly, and half the frames halve the drawing. */
const FRAME_MS = 30;

function loop(now: number) {
  if (now - last >= FRAME_MS) {
    last = now;
    for (const listener of listeners) listener(now / 1000);
  }
  handle = listeners.size > 0 ? requestAnimationFrame(loop) : 0;
}

/**
 * Calls `listener` with the time in seconds on every other animation frame or so (about 30 a
 * second), from one shared loop that runs only while someone listens. Returns the function that stops listening.
 */
export function onFrame(listener: Listener): () => void {
  listeners.add(listener);
  listener(0);
  if (!handle) handle = requestAnimationFrame(loop);
  return () => {
    listeners.delete(listener);
  };
}
