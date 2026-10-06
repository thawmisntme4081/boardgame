// Cloudflare Access: the private site's login gate. Cloudflare signs every request it lets
// through (header `Cf-Access-Jwt-Assertion`, cookie `CF_Authorization`); the server checks
// that signature, so the app's own address (`<app>.fly.dev`) cannot be used to skip the gate.
import type { IncomingMessage } from 'node:http';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/** Whether a request (page or socket handshake) comes through Cloudflare Access. */
export type AccessCheck = (req: IncomingMessage) => Promise<boolean>;

export interface AccessOptions {
  /** The Zero Trust team domain, e.g. `myteam.cloudflareaccess.com`. */
  teamDomain: string;
  /** The Access application's audience tag (AUD). */
  audience: string;
  /** Tests: the signing keys; otherwise fetched from the team domain. */
  keys?: JWTVerifyGetKey;
}

/** The Access token: the header Cloudflare adds, or the cookie the browser keeps. */
export function accessToken(req: IncomingMessage): string | undefined {
  const header = req.headers['cf-access-jwt-assertion'];
  if (typeof header === 'string' && header) return header;
  const cookie = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('CF_Authorization='));
  return cookie?.slice('CF_Authorization='.length) || undefined;
}

export function cloudflareAccess({ teamDomain, audience, keys }: AccessOptions): AccessCheck {
  const issuer = `https://${teamDomain}`;
  const jwks = keys ?? createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  return async (req) => {
    const token = accessToken(req);
    if (!token) return false;
    try {
      await jwtVerify(token, jwks, { issuer, audience });
      return true;
    } catch {
      return false;
    }
  };
}
