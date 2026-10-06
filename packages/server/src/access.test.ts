import type { IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { io as connectClient } from 'socket.io-client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { accessToken, cloudflareAccess, type AccessCheck } from './access';
import { createGameServer } from './app';
import { RoomManager } from './rooms';

const TEAM = 'myteam.cloudflareaccess.com';
const AUD = 'aud-tag-123';

let check: AccessCheck;
let sign: (claims?: { aud?: string; iss?: string; expiresIn?: string }) => Promise<string>;

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
  check = cloudflareAccess({
    teamDomain: TEAM,
    audience: AUD,
    keys: createLocalJWKSet({ keys: [jwk] }),
  });
  sign = ({ aud = AUD, iss = `https://${TEAM}`, expiresIn = '1h' } = {}) =>
    new SignJWT({ email: 'ana@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(iss)
      .setAudience(aud)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(privateKey);
});

const req = (headers: Record<string, string>) => ({ headers }) as unknown as IncomingMessage;

describe('Cloudflare Access token', () => {
  it('is read from the header Cloudflare adds, or from the cookie', () => {
    expect(accessToken(req({ 'cf-access-jwt-assertion': 'abc' }))).toBe('abc');
    expect(accessToken(req({ cookie: 'x=1; CF_Authorization=def; y=2' }))).toBe('def');
    expect(accessToken(req({}))).toBeUndefined();
  });

  it('lets a valid token through and refuses the rest', async () => {
    expect(await check(req({ 'cf-access-jwt-assertion': await sign() }))).toBe(true);
    expect(await check(req({ cookie: `CF_Authorization=${await sign()}` }))).toBe(true);
    expect(await check(req({}))).toBe(false);
    expect(await check(req({ 'cf-access-jwt-assertion': 'not-a-jwt' }))).toBe(false);
    expect(await check(req({ 'cf-access-jwt-assertion': await sign({ aud: 'other-app' }) }))).toBe(
      false,
    );
    expect(
      await check(req({ 'cf-access-jwt-assertion': await sign({ iss: 'https://evil.example' }) })),
    ).toBe(false);
    expect(await check(req({ 'cf-access-jwt-assertion': await sign({ expiresIn: '-1m' }) }))).toBe(
      false,
    );
  });
});

describe('the server behind Cloudflare Access', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await close?.();
    close = undefined;
  });

  async function start() {
    const server = createGameServer(new RoomManager(), { accessCheck: check });
    await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
    const url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
    close = () => new Promise((resolve) => server.io.close(() => resolve()));
    return url;
  }

  it('keeps /health and /robots.txt open, and tells search engines to stay away', async () => {
    const url = await start();
    const health = await fetch(`${url}/health`);
    expect(health.status).toBe(200);
    expect(health.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    const robots = await fetch(`${url}/robots.txt`);
    expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n');
  });

  it('refuses pages and socket connections without a valid Access token', async () => {
    const url = await start();
    expect((await fetch(`${url}/r/ABCD`)).status).toBe(403);
    expect(
      (await fetch(`${url}/r/ABCD`, { headers: { 'cf-access-jwt-assertion': await sign() } }))
        .status,
    ).not.toBe(403);

    const refused = connectClient(url, { transports: ['websocket'], forceNew: true });
    await expect(
      new Promise((resolve, reject) => {
        refused.once('connect', () => resolve(undefined));
        refused.once('connect_error', reject);
      }),
    ).rejects.toBeTruthy();
    refused.disconnect();

    const allowed = connectClient(url, {
      transports: ['websocket'],
      forceNew: true,
      extraHeaders: { 'cf-access-jwt-assertion': await sign() },
    });
    await new Promise((resolve, reject) => {
      allowed.once('connect', () => resolve(undefined));
      allowed.once('connect_error', reject);
    });
    expect(allowed.connected).toBe(true);
    allowed.disconnect();
  });
});
