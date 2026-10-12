import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { GAMES, preloadGame } from './games';
import './index.css';
import '@platform/ui/i18n';

// Error tracking, only in builds made with VITE_SENTRY_DSN (loaded on the side, so it never
// slows the first screen).
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
  void import('@sentry/react').then((Sentry) =>
    Sentry.init({
      dsn: sentryDsn,
      integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
      // Tracing: every page load and HTTP call (same-origin, Sentry's default targets). The
      // game itself runs over a WebSocket, which is not traced.
      tracesSampleRate: 1.0,
      // Session Replay (all text and inputs masked by default): 10% of visits, and every
      // visit that hits an error.
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    }),
  );
}

// Opening a game's page (or the Flight Log, which shows every game) directly: fetch its chunk
// now, alongside the site password check, rather than once the page is drawn.
const page = /^\/(?:play\/([^/]+)|history)/.exec(location.pathname);
if (page) for (const id of page[1] ? [page[1]] : GAMES.map((g) => g.id)) preloadGame(id);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
