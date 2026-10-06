import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // Bundle the workspace package; it ships as TypeScript source.
  noExternal: ['@sky/rules', '@platform/engine', '@platform/protocol'],
});
