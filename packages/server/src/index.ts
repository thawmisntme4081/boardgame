import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudflareAccess } from './access';
import { createGameServer } from './app';
import { log, setErrorReporter } from './log';
import { DEFAULT_IDLE_TTL_MS, DEFAULT_MAX_ROOMS_PER_IP, RoomManager } from './rooms';
import { siteGate } from './siteGate';
import { databaseFile, SqliteMatchStore } from './store';

const PORT = Number(process.env.PORT ?? 3000);
const production = process.env.NODE_ENV === 'production';
const ttlMinutes = Number(process.env.ROOM_TTL_MINUTES);
const roomsPerIp = Number(process.env.ROOMS_PER_IP);
// Fixed dice and test routes are for development and E2E tests only.
const gameSeed = production ? NaN : Number(process.env.GAME_SEED);
const e2eHooks = !production && process.env.E2E_HOOKS === '1';
// A short round timer, to try timed games without waiting 3 minutes (never in production).
const roundTimerSeconds = production ? NaN : Number(process.env.ROUND_TIMER_SECONDS);
// Where games are saved (the Fly volume in production); without it, games live in memory.
const dataDir = process.env.DATA_DIR;
const dbFile = dataDir ? databaseFile(dataDir) : undefined;
// The private site's login gate: both settings come from the Cloudflare Access application.
const accessTeam = process.env.CF_ACCESS_TEAM_DOMAIN;
const accessAud = process.env.CF_ACCESS_AUD;
// Or the simpler gate: one shared password for the whole site (a Fly secret).
const sitePassword = process.env.SITE_PASSWORD;
const trustProxy = process.env.TRUST_PROXY === '1';

// Error tracking, only when a DSN is configured.
if (process.env.SENTRY_DSN) {
  const Sentry = await import('@sentry/node');
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV ?? 'development' });
  setErrorReporter((error) => Sentry.captureException(error));
}

const rooms = new RoomManager({
  idleTtlMs: ttlMinutes > 0 ? ttlMinutes * 60_000 : DEFAULT_IDLE_TTL_MS,
  maxRoomsPerIp: roomsPerIp > 0 ? roomsPerIp : DEFAULT_MAX_ROOMS_PER_IP,
  ...(Number.isInteger(gameSeed) && { seed: () => gameSeed }),
  ...(roundTimerSeconds > 0 && {
    settings: { 'sky-team': { roundTimerMs: roundTimerSeconds * 1000 } },
  }),
  ...(dbFile && { store: new SqliteMatchStore(dbFile) }),
});

// Same path from src/ (tsx) and dist/ (built): packages/client/dist.
const clientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

const { httpServer } = createGameServer(rooms, {
  trustProxy,
  clientDir,
  e2eHooks,
  ...(accessTeam &&
    accessAud && {
      accessCheck: cloudflareAccess({ teamDomain: accessTeam, audience: accessAud }),
    }),
  ...(sitePassword && {
    siteGate: siteGate({ password: sitePassword, secure: production, trustProxy }),
  }),
});

httpServer.listen(PORT, () => {
  log.info(`server listening on http://localhost:${PORT}`);
  if (e2eHooks) log.warn('E2E test routes are ON (never in production)');
  if (Number.isInteger(gameSeed)) log.warn(`every game uses seed ${gameSeed}`);
  if (roundTimerSeconds > 0) log.warn(`timed rounds last ${roundTimerSeconds} s`);
  if (dbFile) log.info({ file: dbFile, rooms: rooms.size }, 'games saved on disk');
  else if (production) log.warn('DATA_DIR is not set: games are lost when the server stops');
  if (accessTeam && accessAud) log.info({ team: accessTeam }, 'Cloudflare Access required');
  if (sitePassword) log.info('site password required');
  if (process.env.SENTRY_DSN) log.info('Sentry error tracking on');
  if (production && !(accessTeam && accessAud) && !sitePassword) {
    log.warn('no site password and no Cloudflare Access: the site is open to anyone');
  }
});

// Fly stops the machine when nobody is connected: write pending saves before exiting.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    rooms.close();
    process.exit(0);
  });
}
