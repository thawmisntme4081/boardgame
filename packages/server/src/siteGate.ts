// The private site's shared password (`SITE_PASSWORD`). The page itself loads for anyone (it
// holds no game data); the game connection (socket handshake) needs the signed cookie a
// correct password gives. Changing the password signs everyone out.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import express, { type Router } from 'express';
import { log } from './log';

export const SITE_COOKIE = 'site_auth';
const DAY_MS = 24 * 60 * 60_000;

export interface SiteGateOptions {
  password: string;
  /** Send the cookie over HTTPS only (production). */
  secure?: boolean;
  /** Behind a proxy (Fly): read the client IP from X-Forwarded-For for the attempt limit. */
  trustProxy?: boolean;
  now?: () => number;
  /** How long a correct password lasts; each visit renews it. */
  maxAgeMs?: number;
  /** Wrong passwords in a row before the address is locked out, and for how long. */
  maxFails?: number;
  lockMs?: number;
}

export interface SiteGate {
  /** Whether the request carries a valid site cookie (pages, socket handshakes). */
  check(req: IncomingMessage): boolean;
  /** `GET /auth/status` and `POST /auth/login`. */
  router: Router;
}

export function readCookie(req: IncomingMessage, name: string): string | undefined {
  const found = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : undefined;
}

const sha256 = (text: string) => createHash('sha256').update(text).digest();
/** Constant-time comparison of two strings of any length. */
const sameText = (a: string, b: string) => timingSafeEqual(sha256(a), sha256(b));

function requestIp(req: IncomingMessage, trustProxy: boolean): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return (trustProxy && first) || req.socket.remoteAddress || 'unknown';
}

export function siteGate({
  password,
  secure = false,
  trustProxy = false,
  now = Date.now,
  maxAgeMs = 30 * DAY_MS,
  maxFails = 5,
  lockMs = 5 * 60_000,
}: SiteGateOptions): SiteGate {
  // The signing key comes from the password: a new password makes every old cookie invalid.
  const key = sha256(`site-gate:${password}`);
  const sign = (expires: number) =>
    createHmac('sha256', key).update(`site:${expires}`).digest('base64url');
  const newToken = () => {
    const expires = now() + maxAgeMs;
    return `${expires}.${sign(expires)}`;
  };
  const valid = (token: string | undefined) => {
    const [expiresText, signature] = token?.split('.') ?? [];
    const expires = Number(expiresText);
    if (!signature || !Number.isFinite(expires) || expires <= now()) return false;
    return sameText(signature, sign(expires));
  };
  const check = (req: IncomingMessage) => valid(readCookie(req, SITE_COOKIE));

  const giveCookie = (res: express.Response) =>
    res.cookie(SITE_COOKIE, newToken(), {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: maxAgeMs,
      path: '/',
    });

  /** Wrong attempts per address: after `maxFails` in a row, locked until `until`. */
  const attempts = new Map<string, { fails: number; until: number }>();

  const router = express.Router();
  router.get('/auth/status', (req, res) => {
    const ok = check(req);
    if (ok) giveCookie(res); // each visit renews the 30 days
    res.json({ gate: true, ok });
  });
  router.post('/auth/login', express.json({ limit: '1kb' }), (req, res) => {
    const ip = requestIp(req, trustProxy);
    const entry = attempts.get(ip);
    if (entry && entry.until > now()) {
      return void res.status(429).json({ ok: false, error: 'too-many-tries' });
    }
    const given: unknown = (req.body as { password?: unknown } | undefined)?.password;
    if (typeof given === 'string' && sameText(given, password)) {
      attempts.delete(ip);
      giveCookie(res);
      log.info('site password accepted');
      return void res.json({ ok: true });
    }
    // A lockout that has ended starts the count again.
    const fails = (entry && entry.until === 0 ? entry.fails : 0) + 1;
    attempts.set(ip, fails >= maxFails ? { fails: 0, until: now() + lockMs } : { fails, until: 0 });
    log.info({ fails }, 'wrong site password');
    res.status(401).json({ ok: false, error: 'wrong-password' });
  });
  return { check, router };
}
