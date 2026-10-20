import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // File-based routes: src/routes/ compiles into src/routeTree.gen.ts (before the React plugin).
  plugins: [tanstackRouter({ target: 'react' }), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Libraries in their own chunks: they change rarely, so a deploy that changes only the
        // app's code leaves them in the browser's cache.
        codeSplitting: {
          groups: [
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'router', test: /[\\/]node_modules[\\/]@tanstack[\\/]/ },
            { name: 'i18n', test: /[\\/]node_modules[\\/](i18next|react-i18next)[\\/]/ },
            {
              name: 'socket',
              test: /[\\/]node_modules[\\/](socket\.io-client|engine\.io-client|socket\.io-parser|engine\.io-parser|@socket\.io)[\\/]/,
            },
          ],
        },
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
      // The site password and accounts (sign-in, Google's callback, /auth/me).
      '/auth': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
