import { mkdtempSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createGameServer, type ServerOptions } from './app';
import { RoomManager } from './rooms';

let close: (() => Promise<void>) | undefined;

afterEach(async () => {
  await close?.();
  close = undefined;
});

async function start(options: ServerOptions, rooms = new RoomManager()) {
  const server = createGameServer(rooms, { sweepIntervalMs: 0, ...options });
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  close = () => new Promise((resolve) => server.io.close(() => resolve()));
  const { port } = server.httpServer.address() as AddressInfo;
  return { url: `http://localhost:${port}`, rooms };
}

const postGame = (url: string, code: string, body: unknown) =>
  fetch(`${url}/__e2e/rooms/${code}/game`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('E2E test routes', () => {
  it('do not exist unless turned on', async () => {
    const rooms = new RoomManager();
    const created = rooms.create('Ana', 's1');
    if (!created.ok) throw new Error(created.error);
    const { code } = created.value.room;
    const { url } = await start({}, rooms);

    expect((await postGame(url, code, { round: 7 })).status).toBe(404);
    expect(rooms.get(code)!.game.round).toBe(1);
  });

  it('merge a partial game state into a room when turned on', async () => {
    const rooms = new RoomManager();
    const created = rooms.create('Ana', 's1');
    if (!created.ok) throw new Error(created.error);
    const { code } = created.value.room;
    const { url } = await start({ e2eHooks: true }, rooms);

    const res = await postGame(url, code, { round: 7, axis: 1 });
    expect(await res.json()).toEqual({ ok: true });
    expect(rooms.get(code)!.game).toMatchObject({ round: 7, axis: 1, phase: 'strategy' });
    expect((await postGame(url, 'ZZZZ', {})).status).toBe(404);
  });
});

describe('client files', () => {
  it('serves the built client and answers invite links with index.html', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sky-client-'));
    writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Sky</title>');
    writeFileSync(path.join(dir, 'app.js'), 'console.log(1)');
    const { url } = await start({ clientDir: dir });

    expect(await (await fetch(`${url}/`)).text()).toContain('<title>Sky</title>');
    expect(await (await fetch(`${url}/app.js`)).text()).toBe('console.log(1)');
    const invite = await fetch(`${url}/r/ABCD`, { headers: { accept: 'text/html' } });
    expect(invite.headers.get('content-type')).toMatch(/text\/html/);
    expect(await (await fetch(`${url}/health`)).json()).toMatchObject({ ok: true });
  });

  it('serves nothing extra when there is no build', async () => {
    const { url } = await start({ clientDir: path.join(tmpdir(), 'does-not-exist') });
    expect((await fetch(`${url}/`, { headers: { accept: 'text/html' } })).status).toBe(404);
  });
});
