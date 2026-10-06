import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
