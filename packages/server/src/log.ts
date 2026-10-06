// Structured logs (one JSON line per event; Fly collects stdout). `LOG_LEVEL` picks the
// level (default `info`); tests are silent. Never log rejoin tokens or Access tokens.
import pino from 'pino';

export const log = pino({
  level: process.env.LOG_LEVEL ?? (process.env.VITEST ? 'silent' : 'info'),
  base: undefined, // no pid/hostname on every line
});

let reporter: (error: unknown) => void = () => {};

/** Sends a caught error to error tracking (Sentry, when `SENTRY_DSN` is set). */
export function reportError(error: unknown): void {
  reporter(error);
}

export function setErrorReporter(report: (error: unknown) => void): void {
  reporter = report;
}
