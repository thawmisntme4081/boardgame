import { defineConfig, devices } from '@playwright/test';

/** The E2E server: the production build with fixed dice and the test-only routes on. */
const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'iPhone 13', use: { ...devices['iPhone 13'] } },
    { name: 'Pixel 7', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm build && node packages/server/dist/index.js',
    url: `http://localhost:${PORT}/health`,
    env: {
      PORT: String(PORT),
      E2E_HOOKS: '1',
      GAME_SEED: '1',
      // Every test creates rooms from 127.0.0.1.
      ROOMS_PER_IP: '1000',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
