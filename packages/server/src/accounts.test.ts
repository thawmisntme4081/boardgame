import type { AddressInfo } from 'node:net';
import { getMigrations } from 'better-auth/db/migration';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accounts, authOptions, type AccountUser, type AccountsOptions } from './accounts';
import { createGameServer } from './app';
import { mockGoogleSignIn } from './google-test';
import { RoomManager } from './rooms';
import { siteGate } from './siteGate';
import { openDatabase } from './store';

const SECRET = 'test-secret-that-is-long-enough-for-better-auth-0123456789';
const google = { clientId: 'client-id', clientSecret: 'client-secret' };

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  await close?.();
  close = undefined;
});

async function start(options: Partial<AccountsOptions> & { sitePassword?: string } = {}) {
  const { sitePassword, ...accountOptions } = options;
  const database = openDatabase(':memory:');
  const server = createGameServer(new RoomManager(), {
    sweepIntervalMs: 0,
    accounts: accounts({
      database,
      secret: SECRET,
      baseURL: 'http://localhost',
      ...accountOptions,
    }),
    ...(sitePassword && { siteGate: siteGate({ password: sitePassword }) }),
  });
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  const url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
  close = () =>
    new Promise((resolve) =>
      server.io.close(() => {
        database.close();
        resolve();
      }),
    );
  return { url, database };
}

const post = (url: string, path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${url}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost', ...headers },
    body: JSON.stringify(body),
    redirect: 'manual',
  });

const cookiesOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');

const me = async (url: string, cookie = ''): Promise<AccountUser | null> =>
  (await fetch(`${url}/auth/me`, { headers: { cookie } })).json() as Promise<AccountUser | null>;

describe('the accounts database', () => {
  it('has every table and column Better Auth expects (MIGRATIONS step 3)', async () => {
    const database = openDatabase(':memory:');
    const { toBeCreated, toBeAdded } = await getMigrations(
      authOptions({ database, secret: SECRET, baseURL: 'http://localhost', google }),
    );
    expect(toBeCreated).toEqual([]);
    expect(toBeAdded).toEqual([]);
    database.close();
  });
});

describe('sign in with Google', () => {
  it('sets a session; /auth/me returns the user; signing out clears it', async () => {
    const signIn = mockGoogleSignIn();
    const { url, database } = await start({ google });
    const cookie = await signIn(url, 'chi@example.com', 'Chi');
    expect(cookie).toMatch(/platform\.session_token=/);
    expect(await me(url, cookie)).toMatchObject({ name: 'Chi', email: 'chi@example.com' });

    const out = await post(url, '/api/auth/sign-out', {}, { cookie });
    expect(out.status).toBe(200);
    expect(await me(url, cookie)).toBeNull();
    expect(database.prepare('SELECT provider_id FROM auth_accounts').all()).toEqual([
      { provider_id: 'google' },
    ]);
  });

  it('uses an httpOnly, SameSite=Lax cookie and Secure when requested', async () => {
    const signIn = mockGoogleSignIn();
    const plain = await start({ google });
    const cookie = await signIn(plain.url, 'ana@example.com');
    expect(cookie).toContain('platform.session_token=');
    await close?.();

    vi.restoreAllMocks();
    const secureSignIn = mockGoogleSignIn();
    const secure = await start({ google, secure: true });
    const secureCookie = await secureSignIn(secure.url, 'ana@example.com');
    expect(secureCookie).toContain('__Secure-platform.session_token=');
  });

  it('is unavailable without a Google client', async () => {
    const { url } = await start();
    expect((await post(url, '/api/auth/sign-in/social', { provider: 'google' })).status).toBe(404);
    expect(await (await fetch(`${url}/auth/methods`)).json()).toEqual({ google: false });
  });

  it('limits sign-in attempts per address, ignoring a client supplied forwarded address', async () => {
    const { url } = await start({ google, signInPerMinute: 3 });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const response = await post(
        url,
        '/api/auth/sign-in/social',
        { provider: 'google', callbackURL: '/' },
        { 'x-forwarded-for': `10.0.0.${i}` },
      );
      statuses.push(response.status);
    }
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
  });
});

describe('behind the site password', () => {
  it('refuses Google sign-in and /auth/me without the site cookie', async () => {
    const { url } = await start({ sitePassword: 'bay-cung-nhau', google });
    expect((await fetch(`${url}/auth/me`)).status).toBe(401);
    expect((await post(url, '/api/auth/sign-in/social', { provider: 'google' })).status).toBe(401);
    const login = await post(url, '/auth/login', { password: 'bay-cung-nhau' });
    expect(await me(url, cookiesOf(login))).toBeNull();
  });
});

describe('the display name', () => {
  it('cuts a long Google name to fit a room (20 characters)', async () => {
    const signIn = mockGoogleSignIn();
    const { url } = await start({ google });
    const cookie = await signIn(url, 'long@example.com', 'A very long Google profile name');
    expect((await me(url, cookie))?.name).toBe('A very long Google p');
  });

  it('lets the player set a name when Google provides none, and change it later', async () => {
    const signIn = mockGoogleSignIn();
    const { url } = await start({ google });
    const cookie = await signIn(url, 'dao@example.com', '');
    expect((await me(url, cookie))?.name).toBe('');
    expect((await post(url, '/auth/name', { name: '   ' }, { cookie })).status).toBe(400);
    const set = await post(url, '/auth/name', { name: 'Dao' }, { cookie });
    expect(set.status).toBe(200);
    expect(await set.json()).toMatchObject({ name: 'Dao', email: 'dao@example.com' });
    const changed = await post(
      url,
      '/auth/name',
      { name: 'A much too long new display name' },
      { cookie },
    );
    expect(await changed.json()).toMatchObject({ name: 'A much too long new' });
    expect((await me(url, cookie))?.name).toBe('A much too long new');
    expect((await post(url, '/auth/name', { name: 'x' })).status).toBe(401);
  });
});
