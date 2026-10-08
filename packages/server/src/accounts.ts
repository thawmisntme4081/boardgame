// Optional accounts (Platform 06): sign in with Google through Better Auth on
// the platform's SQLite database (tables `users`, `auth_sessions`, `auth_accounts`,
// `auth_verifications`, created by `MIGRATIONS` step 3). Better Auth answers under
// `/api/auth/*` (sign-in, the Google callback, sign-out); `GET /auth/me` says who is signed in.
// Guests need none of it. The session cookie is separate from the site password's cookie.
import type { IncomingMessage } from 'node:http';
import { betterAuth } from 'better-auth';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import type Database from 'better-sqlite3';
import express, { type Router } from 'express';
import { log, reportError } from './log';
import { requestIp } from './siteGate';

/** Where Better Auth answers: sign-in, the OAuth callback, sign-out, its own session check. */
export const AUTH_BASE_PATH = '/api/auth';
/** The client address, set by the server from the socket (or a trusted proxy) for each request. */
const CLIENT_IP_HEADER = 'x-platform-client-ip';
const DAY_S = 24 * 60 * 60;
/** Same limit as a player's name in a room (`@platform/protocol`). */
export const NAME_MAX = 20;
/** A display name as rooms accept it: trimmed, at most `NAME_MAX` characters. */
export const fitName = (name: string): string =>
  [...name.trim()].slice(0, NAME_MAX).join('').trim();

export interface AccountsOptions {
  /** The platform's database, migrated (`openDatabase`). */
  database: Database.Database;
  /** Signs session cookies and encrypts provider tokens (`AUTH_SECRET`, 32+ characters). */
  secret: string;
  /** The site's address as the browser sees it (`AUTH_URL`): Google's redirect URL starts here. */
  baseURL: string;
  /** Other origins allowed to call the sign-in endpoints (the Vite dev server). */
  trustedOrigins?: string[];
  /** HTTPS only cookies (production). */
  secure?: boolean;
  /** Behind a proxy (Fly): the client address comes from X-Forwarded-For. */
  trustProxy?: boolean;
  /** Sign in with Google, when its OAuth client is set up. */
  google?: { clientId: string; clientSecret: string };
  /** Sign-in requests per address per minute. */
  signInPerMinute?: number;
}

/** The signed-in user as `GET /auth/me` returns it. */
export interface AccountUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface Accounts {
  /** The signed-in user of a request (HTTP or socket handshake), or `null`. */
  userOf(req: IncomingMessage): Promise<AccountUser | null>;
  /** Removes the account, its sessions and its provider links. */
  deleteUser(id: string): Promise<void>;
  /** `/api/auth/*` and `GET /auth/me`. */
  router: Router;
  /** Which sign-in methods are on. */
  methods: { google: boolean };
}

/** Better Auth's names for our snake_case columns. */
const COLUMNS = {
  user: { emailVerified: 'email_verified', createdAt: 'created_at', updatedAt: 'updated_at' },
  session: {
    expiresAt: 'expires_at',
    ipAddress: 'ip_address',
    userAgent: 'user_agent',
    userId: 'user_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  account: {
    accountId: 'account_id',
    providerId: 'provider_id',
    userId: 'user_id',
    accessToken: 'access_token',
    refreshToken: 'refresh_token',
    idToken: 'id_token',
    accessTokenExpiresAt: 'access_token_expires_at',
    refreshTokenExpiresAt: 'refresh_token_expires_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  verification: { expiresAt: 'expires_at', createdAt: 'created_at', updatedAt: 'updated_at' },
} as const;

/**
 * Sign-in attempts per address, in this server's memory (one server instance). Better Auth's
 * own memory store is shared by every instance in a process; this one is not.
 */
function memoryRateLimit() {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    consume(key: string, rule: { window: number; max: number }) {
      const now = Date.now();
      const windowMs = rule.window * 1000;
      if (windows.size > 10_000) {
        for (const [k, w] of windows) if (now - w.start >= windowMs) windows.delete(k);
      }
      const current = windows.get(key);
      if (!current || now - current.start >= windowMs) {
        windows.set(key, { start: now, count: 1 });
        return Promise.resolve({ allowed: true, retryAfter: null });
      }
      if (current.count >= rule.max) {
        const retryAfter = Math.ceil((current.start + windowMs - now) / 1000);
        return Promise.resolve({ allowed: false, retryAfter });
      }
      current.count++;
      return Promise.resolve({ allowed: true, retryAfter: null });
    },
  };
}

/** Better Auth's options, kept apart so tests can compare its schema with `MIGRATIONS`. */
export function authOptions({
  database,
  secret,
  baseURL,
  trustedOrigins = [],
  secure = false,
  google,
  signInPerMinute = 10,
}: AccountsOptions) {
  const signInRule = { window: 60, max: signInPerMinute };
  return {
    database,
    secret,
    baseURL,
    basePath: AUTH_BASE_PATH,
    trustedOrigins,
    user: { modelName: 'users', fields: COLUMNS.user },
    session: { modelName: 'auth_sessions', fields: COLUMNS.session, expiresIn: 30 * DAY_S },
    account: { modelName: 'auth_accounts', fields: COLUMNS.account },
    verification: { modelName: 'auth_verifications', fields: COLUMNS.verification },
    // The display name comes from the sign-in (Google's name, cut to fit a room) or is asked
    // if Google provides none, and the player may change it any time (`POST /auth/name`).
    databaseHooks: {
      user: {
        create: {
          before: (user: { name: string }) =>
            Promise.resolve({ data: { ...user, name: fitName(user.name) } }),
        },
      },
    },
    // Nothing else may change a profile: no free name or email changes, no passwords.
    disabledPaths: ['/update-user', '/change-email', '/change-password', '/set-password'],
    ...(google && {
      socialProviders: {
        google: {
          clientId: google.clientId,
          clientSecret: google.clientSecret,
          prompt: 'select_account' as const,
        },
      },
    }),
    // On in every environment (Better Auth's default is production only), per address.
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/*': signInRule,
      },
      customStorage: memoryRateLimit(),
    },
    advanced: {
      cookiePrefix: 'platform',
      useSecureCookies: secure,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' as const, secure },
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
    // Messages only: Better Auth's extra arguments can hold requests, cookies or tokens.
    logger: {
      log: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => {
        log[level]({ from: 'auth' }, message);
      },
    },
    onAPIError: { onError: (error: unknown) => reportError(error) },
  };
}

export function accounts(options: AccountsOptions): Accounts {
  const auth = betterAuth(authOptions(options));
  const trustProxy = options.trustProxy ?? false;

  /** The client address for Better Auth's rate limit, never what the client claims. */
  const setClientIp = (req: IncomingMessage) => {
    req.headers[CLIENT_IP_HEADER] = requestIp(req, trustProxy);
  };

  const userOf = async (req: IncomingMessage): Promise<AccountUser | null> => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return null;
    const { id, name, email, image } = session.user;
    return { id, name, email, image: image ?? null };
  };

  const handler = toNodeHandler(auth);
  const router = express.Router();
  // Before any body parser: Better Auth reads the body itself.
  router.all(`${AUTH_BASE_PATH}/*splat`, (req, res) => {
    setClientIp(req);
    void handler(req, res);
  });
  router.get('/auth/methods', (_req, res) => {
    res.json({ google: Boolean(options.google) });
  });
  // The display name: asked if Google's profile had none, changed from the account menu.
  router.post('/auth/name', express.json({ limit: '1kb' }), (req, res) => {
    const given: unknown = (req.body as { name?: unknown } | undefined)?.name;
    const name = typeof given === 'string' ? fitName(given) : '';
    if (!name) return void res.status(400).json({ error: 'bad-name' });
    userOf(req)
      .then(async (user) => {
        if (!user) return void res.status(401).json({ error: 'signed-out' });
        const context = await auth.$context;
        await context.internalAdapter.updateUser(user.id, { name });
        res.json({ ...user, name });
      })
      .catch((error: unknown) => {
        reportError(error);
        res.status(500).json({ error: 'unknown' });
      });
  });
  router.get('/auth/me', (req, res) => {
    userOf(req).then(
      (user) => res.json(user),
      (error: unknown) => {
        reportError(error);
        res.status(500).json(null);
      },
    );
  });

  const deleteUser = async (id: string) => {
    const context = await auth.$context;
    await context.internalAdapter.deleteUser(id);
  };

  return {
    userOf,
    deleteUser,
    router,
    methods: { google: Boolean(options.google) },
  };
}
