import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // A game's lazy chunk is named after the game (assets/sky-team-*.js), not its entry file.
        chunkFileNames: (chunk) => {
          const game = /[\\/]games[\\/]([^\\/]+)[\\/]/.exec(chunk.facadeModuleId ?? '')?.[1];
          return `assets/${game ?? '[name]'}-[hash].js`;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
  server: {
    // Forward API and socket traffic to the Node server during development.
    proxy: {
      '/health': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
