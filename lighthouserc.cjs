// Lighthouse CI: mobile audit of the production build (run `pnpm build` first). Runs in CI
// on Linux; on Windows, Lighthouse's Chrome launcher fails deleting its temp folder (EPERM).
// The game screens need two seated players, so the lobby and an invite link are audited.
const PORT = '3200';
process.env.PORT = PORT; // inherited by the server started below

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'node packages/server/dist/index.js',
      startServerReadyPattern: 'server listening',
      url: [`http://localhost:${PORT}/`, `http://localhost:${PORT}/r/ABCD`],
      numberOfRuns: 1,
      // Lighthouse's default is a mid-range phone on a throttled mobile connection.
      settings: { chromeFlags: '--no-sandbox --headless=new' },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.9 }],
        // Touch targets big enough and spaced apart (CLAUDE.md: >= 44px).
        'target-size': 'error',
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci' },
  },
};
