import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each package is its own project; the client picks up its vite.config.ts.
    projects: ['packages/*'],
    passWithNoTests: true,
  },
});
