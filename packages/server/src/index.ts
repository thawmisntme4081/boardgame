import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudflareAccess } from './access';
import { accounts } from './accounts';
import { createGameServer } from './app';
import { resendSender, terminalSender, type SendCode } from './email';
import { log, setErrorReporter } from './log';
import { DEFAULT_IDLE_TTL_MS, DEFAULT_MAX_ROOMS_PER_IP, RoomManager } from './rooms';
import { siteGate } from './siteGate';
import { databaseFile, openDatabase, SqliteMatchStore } from './store';

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
// Accounts (sign in with Google or an email code). The secret signs sessions: required in
// production; development uses a fixed one. AUTH_URL is the site's address as the browser
// sees it (Google's redirect URL starts there): the Vite dev server by default.
const authSecret =
  process.env.AUTH_SECRET ?? (production ? undefined : 'dev-only-auth-secret-not-for-production');
const authUrl = process.env.AUTH_URL ?? (production ? undefined : 'http://localhost:5173');
const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
    : undefined;
// Email codes go through Resend; in development without a key, to this terminal.
const sendCode: SendCode | undefined =
  process.env.RESEND_API_KEY && process.env.EMAIL_FROM
    ? resendSender({ apiKey: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM })
    : production
      ? undefined
      : terminalSender;

// Error tracking, only when a DSN is configured.
if (process.env.SENTRY_DSN) {
  const Sentry = await import('@sentry/node');
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV ?? 'development' });
  setErrorReporter((error) => Sentry.captureException(error));
}

// One database for games and accounts: the file in DATA_DIR, else memory (lost on restart).
const database = openDatabase(dbFile ?? ':memory:');

const rooms = new RoomManager({
  idleTtlMs: ttlMinutes > 0 ? ttlMinutes * 60_000 : DEFAULT_IDLE_TTL_MS,
  maxRoomsPerIp: roomsPerIp > 0 ? roomsPerIp : DEFAULT_MAX_ROOMS_PER_IP,
  ...(Number.isInteger(gameSeed) && { seed: () => gameSeed }),
  ...(roundTimerSeconds > 0 && {
    settings: { 'sky-team': { roundTimerMs: roundTimerSeconds * 1000 } },
  }),
  ...(dbFile && { store: new SqliteMatchStore(database) }),
});

// Same path from src/ (tsx) and dist/ (built): packages/web/dist.
const clientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');

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
  ...(authSecret &&
    authUrl && {
      accounts: accounts({
        database,
        secret: authSecret,
        baseURL: authUrl,
        // In development the page may come from Vite or from the server itself.
        trustedOrigins: production ? [] : [`http://localhost:${PORT}`],
        secure: production,
        trustProxy,
        google,
        sendCode,
      }),
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
  if (authSecret && authUrl) {
    log.info({ url: authUrl, google: Boolean(google), email: Boolean(sendCode) }, 'accounts on');
    if (sendCode === terminalSender)
      log.warn('email sign-in codes are printed here (no RESEND_API_KEY)');
  } else if (production) {
    log.warn('AUTH_SECRET or AUTH_URL is not set: accounts are off');
  }
  if (production && !(accessTeam && accessAud) && !sitePassword) {
    log.warn('no site password and no Cloudflare Access: the site is open to anyone');
  }
});

// Fly stops the machine when nobody is connected: write pending saves before exiting.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    rooms.close();
    if (database.open) database.close();
    process.exit(0);
  });
}
