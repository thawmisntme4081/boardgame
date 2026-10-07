import type { AddressInfo } from 'node:net';
import { getMigrations } from 'better-auth/db/migration';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accounts, authOptions, type AccountsOptions, type AccountUser } from './accounts';
import { createGameServer } from './app';
import { log } from './log';
import { RoomManager } from './rooms';
import { siteGate } from './siteGate';
import { openDatabase } from './store';

const SECRET = 'test-secret-that-is-long-enough-for-better-auth-0123456789';

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  await close?.();
  close = undefined;
});

/** A server with accounts on a fresh database; `codes` collects the emails sent. */
async function start(options: Partial<AccountsOptions> & { sitePassword?: string } = {}) {
  const { sitePassword, ...accountOptions } = options;
  const database = openDatabase(':memory:');
  const codes: { email: string; code: string }[] = [];
  const server = createGameServer(new RoomManager(), {
    sweepIntervalMs: 0,
    accounts: accounts({
      database,
      secret: SECRET,
      baseURL: 'http://localhost',
      sendCode: (email, code) => {
        codes.push({ email, code });
        return Promise.resolve();
      },
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
  return { url, codes, database };
}

/** Better Auth checks the Origin of sign-in requests against its base URL. */
const post = (url: string, path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${url}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost', ...headers },
    body: JSON.stringify(body),
    redirect: 'manual',
  });

/** The `name=value` pairs a response sets, to send back as a cookie header. */
const cookiesOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');

const me = async (url: string, cookie = ''): Promise<AccountUser | null> =>
  (await fetch(`${url}/auth/me`, { headers: { cookie } })).json() as Promise<AccountUser | null>;

async function signInWithCode(url: string, codes: { code: string }[], email: string) {
  const sent = await post(url, '/api/auth/email-otp/send-verification-otp', {
    email,
    type: 'sign-in',
  });
  expect(sent.status).toBe(200);
  return post(url, '/api/auth/sign-in/email-otp', { email, otp: codes.at(-1)!.code });
}

describe('the accounts database', () => {
  it('has every table and column Better Auth expects (MIGRATIONS step 3)', async () => {
    const database = openDatabase(':memory:');
    const { toBeCreated, toBeAdded } = await getMigrations(
      authOptions({
        database,
        secret: SECRET,
        baseURL: 'http://localhost',
        google: { clientId: 'id', clientSecret: 'secret' },
        sendCode: () => Promise.resolve(),
      }),
    );
    expect(toBeCreated).toEqual([]);
    expect(toBeAdded).toEqual([]);
    database.close();
  });
});

describe('sign in with an email code', () => {
  it('sets a session cookie; /auth/me returns the user; signing out clears it', async () => {
    const { url, codes } = await start();
    expect(await me(url)).toBeNull();

    const res = await signInWithCode(url, codes, 'ana@example.com');
    expect(res.status).toBe(200);
    expect(codes).toEqual([{ email: 'ana@example.com', code: expect.stringMatching(/^\d{6}$/) }]);
    const cookie = cookiesOf(res);
    expect(cookie).toMatch(/platform\.session_token=/);

    expect(await me(url, cookie)).toMatchObject({ email: 'ana@example.com', image: null });

    const out = await post(url, '/api/auth/sign-out', {}, { cookie });
    expect(out.status).toBe(200);
    expect(await me(url, cookie)).toBeNull();
  });

  it('refuses a wrong code', async () => {
    const { url, codes } = await start();
    await post(url, '/api/auth/email-otp/send-verification-otp', {
      email: 'ben@example.com',
      type: 'sign-in',
    });
    const wrong = codes[0]!.code === '000000' ? '111111' : '000000';
    const res = await post(url, '/api/auth/sign-in/email-otp', {
      email: 'ben@example.com',
      otp: wrong,
    });
    expect(res.status).toBe(400);
    expect(cookiesOf(res)).not.toMatch(/session_token/);
  });

  it('gives an httpOnly, SameSite=Lax cookie, Secure only when asked', async () => {
    const plain = await start();
    const res = await signInWithCode(plain.url, plain.codes, 'ana@example.com');
    const session = res.headers.getSetCookie().find((c) => c.includes('session_token='))!;
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=Lax/i);
    expect(session).not.toMatch(/Secure/i);
    await close?.();

    const secure = await start({ secure: true });
    const res2 = await signInWithCode(secure.url, secure.codes, 'ana@example.com');
    const session2 = res2.headers.getSetCookie().find((c) => c.includes('session_token='))!;
    expect(session2).toMatch(/^__Secure-platform\.session_token=/);
    expect(session2).toMatch(/; Secure/i);
  });

  it('limits sign-in requests per address, whatever X-Forwarded-For the client sends', async () => {
    const { url } = await start({ signInPerMinute: 3 });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await post(
        url,
        '/api/auth/email-otp/send-verification-otp',
        { email: `p${i}@example.com`, type: 'sign-in' },
        { 'x-forwarded-for': `10.0.0.${i}` },
      );
      statuses.push(res.status);
    }
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
  });

  it('never logs the code or the session token', async () => {
    const lines: string[] = [];
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      vi.spyOn(log, level).mockImplementation(((...args: unknown[]) => {
        lines.push(JSON.stringify(args));
      }) as never);
    }
    const { url, codes } = await start();
    const res = await signInWithCode(url, codes, 'ana@example.com');
    const token = cookiesOf(res).match(/session_token=([^;]+)/)![1]!;
    await post(url, '/api/auth/sign-in/email-otp', { email: 'ana@example.com', otp: '000000' });
    const all = lines.join('\n');
    expect(all).not.toContain(codes[0]!.code);
    expect(all).not.toContain(decodeURIComponent(token).split('.')[0]);
  });
});

/** A Google ID token as Better Auth reads it (it trusts the token endpoint's answer). */
const idToken = (claims: Record<string, unknown>) =>
  [{ alg: 'none', typ: 'JWT' }, claims, 'sig']
    .map((part) =>
      Buffer.from(typeof part === 'string' ? part : JSON.stringify(part)).toString('base64url'),
    )
    .join('.');

/** Google's token endpoint, mocked: it answers with an ID token for `claims`. */
function mockGoogle(claims: Record<string, unknown>) {
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const target = input instanceof Request ? input.url : String(input);
    if (target.startsWith('https://oauth2.googleapis.com/token')) {
      return Promise.resolve(
        Response.json({
          access_token: 'google-access',
          token_type: 'Bearer',
          expires_in: 3600,
          id_token: idToken({ email_verified: true, ...claims }),
        }),
      );
    }
    return realFetch(input, init);
  });
}

/** Starts a Google sign-in and comes back through the callback; returns the session cookie. */
async function signInWithGoogle(url: string) {
  const begin = await post(url, '/api/auth/sign-in/social', {
    provider: 'google',
    callbackURL: '/',
  });
  const { url: googleUrl } = (await begin.json()) as { url: string };
  const state = new URL(googleUrl).searchParams.get('state')!;
  const back = await fetch(`${url}/api/auth/callback/google?code=abc&state=${state}`, {
    headers: { cookie: cookiesOf(begin) },
    redirect: 'manual',
  });
  return cookiesOf(back);
}

describe('sign in with Google', () => {
  it('signs in through the callback with the provider mocked', async () => {
    mockGoogle({
      sub: 'google-123',
      email: 'chi@example.com',
      name: 'Chi',
      picture: 'https://example.com/chi.png',
    });

    const { url, database } = await start({
      google: { clientId: 'client-id', clientSecret: 'client-secret' },
    });
    const begin = await post(url, '/api/auth/sign-in/social', {
      provider: 'google',
      callbackURL: '/',
    });
    expect(begin.status).toBe(200);
    const { url: googleUrl } = (await begin.json()) as { url: string };
    const google = new URL(googleUrl);
    expect(google.origin).toBe('https://accounts.google.com');
    expect(google.searchParams.get('redirect_uri')).toBe(
      'http://localhost/api/auth/callback/google',
    );

    const state = google.searchParams.get('state')!;
    const back = await fetch(`${url}/api/auth/callback/google?code=abc&state=${state}`, {
      headers: { cookie: cookiesOf(begin) },
      redirect: 'manual',
    });
    expect(back.status).toBe(302);
    const cookie = cookiesOf(back);
    expect(await me(url, cookie)).toMatchObject({
      name: 'Chi',
      email: 'chi@example.com',
      image: 'https://example.com/chi.png',
    });
    const link = database.prepare('SELECT provider_id, account_id FROM auth_accounts').all() as {
      provider_id: string;
      account_id: string;
    }[];
    expect(link).toEqual([{ provider_id: 'google', account_id: 'google-123' }]);
  });

  it('is off without a Google client', async () => {
    const { url } = await start();
    const res = await post(url, '/api/auth/sign-in/social', {
      provider: 'google',
      callbackURL: '/',
    });
    expect(res.status).toBe(404);
  });
});

describe('behind the site password', () => {
  it('refuses sign-in and /auth/me without the site cookie', async () => {
    const { url, codes } = await start({ sitePassword: 'bay-cung-nhau' });
    expect((await fetch(`${url}/auth/me`)).status).toBe(401);
    const sent = await post(url, '/api/auth/email-otp/send-verification-otp', {
      email: 'ana@example.com',
      type: 'sign-in',
    });
    expect(sent.status).toBe(401);
    expect(codes).toEqual([]);

    const login = await post(url, '/auth/login', { password: 'bay-cung-nhau' });
    const site = cookiesOf(login);
    expect(await me(url, site)).toBeNull();
  });
});

describe('the display name', () => {
  it('cuts a long Google name to fit a room (20 characters)', async () => {
    mockGoogle({
      sub: 'g-long',
      email: 'long@example.com',
      name: '  Nguyễn Thanh Tuấn Hugo Nguyen  ',
    });
    const { url } = await start({ google: { clientId: 'id', clientSecret: 'secret' } });
    const cookie = await signInWithGoogle(url);
    expect((await me(url, cookie))?.name).toBe('Nguyễn Thanh Tuấn Hu');
  });

  it('is asked once after an email sign-in, then fixed', async () => {
    const { url, codes } = await start();
    const cookie = cookiesOf(await signInWithCode(url, codes, 'dao@example.com'));
    expect((await me(url, cookie))?.name).toBe('');

    expect((await post(url, '/auth/name', { name: '   ' }, { cookie })).status).toBe(400);
    const set = await post(url, '/auth/name', { name: '  Đào  ' }, { cookie });
    expect(set.status).toBe(200);
    expect(await set.json()).toMatchObject({ name: 'Đào', email: 'dao@example.com' });
    expect((await me(url, cookie))?.name).toBe('Đào');

    expect((await post(url, '/auth/name', { name: 'Other' }, { cookie })).status).toBe(409);
    expect((await me(url, cookie))?.name).toBe('Đào');
  });

  it("cannot be set signed out, nor through Better Auth's own profile endpoint", async () => {
    const { url, codes } = await start();
    expect((await post(url, '/auth/name', { name: 'Ana' })).status).toBe(401);
    const cookie = cookiesOf(await signInWithCode(url, codes, 'ana@example.com'));
    const update = await post(url, '/api/auth/update-user', { name: 'Ana' }, { cookie });
    expect(update.status).toBe(404);
    expect((await me(url, cookie))?.name).toBe('');
  });
});

describe('sign-in methods', () => {
  it('says which methods are on', async () => {
    const both = await start({ google: { clientId: 'id', clientSecret: 'secret' } });
    expect(await (await fetch(`${both.url}/auth/methods`)).json()).toEqual({
      google: true,
      email: true,
    });
    await close?.();
    const emailOnly = await start();
    expect(await (await fetch(`${emailOnly.url}/auth/methods`)).json()).toEqual({
      google: false,
      email: true,
    });
  });
});
