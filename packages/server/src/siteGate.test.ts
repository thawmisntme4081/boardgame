import type { AddressInfo } from 'node:net';
import { io as connectClient } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { createGameServer } from './app';
import { RoomManager } from './rooms';
import { SITE_COOKIE, siteGate, type SiteGateOptions } from './siteGate';

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  await close?.();
  close = undefined;
});

async function start(gate?: Partial<SiteGateOptions>) {
  const server = createGameServer(new RoomManager(), {
    ...(gate && { siteGate: siteGate({ password: 'bay-cung-nhau', ...gate }) }),
  });
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  const url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
  close = () => new Promise((resolve) => server.io.close(() => resolve()));
  return url;
}

const login = (url: string, password: unknown) =>
  fetch(`${url}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });

/** The `site_auth=...` pair from a response, to send back as a cookie. */
const cookieOf = (res: Response) => res.headers.get('set-cookie')?.split(';')[0] ?? '';

const status = async (url: string, cookie = '') =>
  (await fetch(`${url}/auth/status`, { headers: { cookie } })).json() as Promise<{
    gate: boolean;
    ok: boolean;
  }>;

function connects(url: string, cookie?: string): Promise<boolean> {
  const socket = connectClient(url, {
    transports: ['websocket'],
    forceNew: true,
    ...(cookie && { extraHeaders: { cookie } }),
  });
  return new Promise((resolve) => {
    socket.once('connect', () => {
      socket.disconnect();
      resolve(true);
    });
    socket.once('connect_error', () => {
      socket.disconnect();
      resolve(false);
    });
  });
}

describe('site password', () => {
  it('is off without a password: the status says open and sockets connect', async () => {
    const url = await start();
    expect(await status(url)).toEqual({ gate: false, ok: true });
    expect(await connects(url)).toBe(true);
  });

  it('gives a cookie for the right password, and only then lets the game connect', async () => {
    const gated = await start({});
    expect(await status(gated)).toEqual({ gate: true, ok: false });
    expect(await connects(gated)).toBe(false);

    const wrong = await login(gated, 'nope');
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ ok: false, error: 'wrong-password' });
    expect(wrong.headers.get('set-cookie')).toBeNull();

    const right = await login(gated, 'bay-cung-nhau');
    expect(await right.json()).toEqual({ ok: true });
    const setCookie = right.headers.get('set-cookie')!;
    expect(setCookie).toMatch(new RegExp(`^${SITE_COOKIE}=`));
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    const cookie = cookieOf(right);
    expect(await status(gated, cookie)).toEqual({ gate: true, ok: true });
    expect(await connects(gated, cookie)).toBe(true);
  });

  it('marks the cookie Secure in production', async () => {
    const url = await start({ secure: true });
    expect((await login(url, 'bay-cung-nhau')).headers.get('set-cookie')).toMatch(/Secure/);
  });

  it('refuses a forged, an expired or an old-password cookie', async () => {
    let now = 1_000_000;
    const url = await start({ now: () => now, maxAgeMs: 60_000 });
    const cookie = cookieOf(await login(url, 'bay-cung-nhau'));
    expect(await status(url, cookie)).toMatchObject({ ok: true });
    // Forged: same expiry, wrong signature.
    expect(await status(url, cookie.replace(/\.[^.]+$/, '.forged'))).toMatchObject({ ok: false });
    // Expired.
    now += 61_000;
    expect(await status(url, cookie)).toMatchObject({ ok: false });
    expect(await connects(url, cookie)).toBe(false);

    // A new password signs everyone out.
    await close!();
    now = 1_000_000;
    const changed = await start({ now: () => now, password: 'mat-khau-moi' });
    expect(await status(changed, cookie)).toMatchObject({ ok: false });
  });

  it('locks an address out after too many wrong passwords, then lets it try again', async () => {
    let now = 0;
    const url = await start({ now: () => now, maxFails: 3, lockMs: 60_000 });
    for (let i = 0; i < 3; i++) expect((await login(url, 'wrong')).status).toBe(401);
    // Locked: even the right password waits.
    const locked = await login(url, 'bay-cung-nhau');
    expect(locked.status).toBe(429);
    expect(await locked.json()).toEqual({ ok: false, error: 'too-many-tries' });
    now += 61_000;
    expect((await login(url, 'bay-cung-nhau')).status).toBe(200);
  });

  it('ignores a missing or non-text password', async () => {
    const url = await start({});
    expect((await login(url, undefined)).status).toBe(401);
    expect((await login(url, 12345)).status).toBe(401);
  });
});
