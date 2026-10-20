import { defineConfig } from 'vitest/config';

// The engine kit plays whole games and `canActInView` compares every move on many states: slow
// when the full run keeps every core busy, so these tests get longer than the default 5 s.
export default defineConfig({
  test: { testTimeout: 30_000 },
});
