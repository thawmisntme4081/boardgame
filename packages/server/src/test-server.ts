// Helpers for integration tests: a real server on a random port and typed clients.
import type { AddressInfo } from 'node:net';
import type {
  AckResult,
  ClientToServer,
  GameSetup,
  GameState as SkyTeamState,
  PlayerMove,
  PlayerView,
  ServerToClient,
} from '@sky/rules';
import type { SkyTeamConfig } from '@sky/rules/definition';
import { io as connectClient, type Socket } from 'socket.io-client';
import { createGameServer, type ServerOptions } from './app';
import { RoomManager, type Room } from './rooms';

export type Client = Socket<ServerToClient, ClientToServer>;

/** A Sky Team room with its game's types (the platform sees them as unknown). */
export type SkyRoom = Room<SkyTeamState, SkyTeamConfig>;

/** Rooms for tests that play Sky Team: the same manager, with Sky Team's state and config. */
export class SkyRooms extends RoomManager<SkyTeamState, SkyTeamConfig> {}

/** The match each client last saw a view of: its moves and rematches name it. */
const seenMatch = new WeakMap<Client, string>();

/**
 * One counter for every client in the test process, so a new connection for a seat (a
 * rejoin, a restarted server) always sends a `seq` above the ones the seat already used.
 */
let lastSeq = 0;

function track(socket: Client): void {
  socket.on('match:view', ({ matchId }) => seenMatch.set(socket, matchId));
  const orig = socket.emitWithAck.bind(socket);
  socket.emitWithAck = (async (event: never, ...args: never[]) => {
    const res = await (orig as (...a: unknown[]) => Promise<unknown>)(event, ...args);
    if (res && typeof res === 'object' && 'matchId' in res && typeof res.matchId === 'string') {
      seenMatch.set(socket, res.matchId);
    }
    return res;
  }) as typeof socket.emitWithAck;
}

/** A move on the match this client is looking at, with a new `seq`. */
export function move(client: Client, move: PlayerMove): Promise<AckResult> {
  return moveWithSeq(client, ++lastSeq, move);
}

/** A move with a chosen `seq`: the same one twice is a resend. */
export function moveWithSeq(client: Client, seq: number, move: PlayerMove): Promise<AckResult> {
  const matchId = seenMatch.get(client) ?? 'none';
  return client.emitWithAck('match:move', { matchId, seq, move });
}

/** "Fly again" from the match this client is looking at, optionally with a new setup. */
export function rematch(client: Client, config?: GameSetup): Promise<AckResult> {
  const matchId = seenMatch.get(client) ?? 'none';
  return client.emitWithAck('room:rematch', { matchId, ...(config && { config }) });
}

/** "Not now" to a rematch offer (or taking one's own back), for the match this client sees. */
export function declineRematch(client: Client): Promise<AckResult> {
  const matchId = seenMatch.get(client) ?? 'none';
  return client.emitWithAck('room:rematch-decline', { matchId });
}

/** Resolves with the next view this client receives. Call before triggering it. */
export function nextView(client: Client): Promise<PlayerView> {
  return new Promise((resolve) => client.once('match:view', ({ view }) => resolve(view)));
}

export async function startTestServer(rooms = new SkyRooms(), options: ServerOptions = {}) {
  const server = createGameServer(rooms, options);
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  const { port } = server.httpServer.address() as AddressInfo;
  const url = `http://localhost:${port}`;
  const clients: Client[] = [];

  return {
    ...server,
    rooms,
    url,
    /** A new connection; `cookie` is sent with the handshake (a signed-in device). */
    async connect(cookie?: string): Promise<Client> {
      const socket: Client = connectClient(url, {
        transports: ['websocket'],
        forceNew: true,
        ...(cookie && { extraHeaders: { cookie } }),
      });
      clients.push(socket);
      track(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
      });
      return socket;
    },
    async close(): Promise<void> {
      for (const socket of clients) socket.disconnect();
      await new Promise<void>((resolve) => server.io.close(() => resolve()));
    },
  };
}

/** Resolves with the next payload of `event`. Call before triggering it. */
export function next<E extends keyof ServerToClient>(
  socket: Client,
  event: E,
): Promise<Parameters<ServerToClient[E]>[0]> {
  return new Promise((resolve) => {
    socket.once(event, ((payload: Parameters<ServerToClient[E]>[0]) => resolve(payload)) as never);
  });
}

function onceView(client: Client) {
  let cb: (({ view }: { view: PlayerView }) => void) | undefined;
  const promise = new Promise<PlayerView>((resolve) => {
    cb = ({ view }) => resolve(view);
    client.once('match:view', cb);
  });
  return {
    promise,
    cancel: () => {
      if (cb) client.off('match:view', cb);
    },
  };
}

export async function takeOff(pilot: Client, copilot: Client): Promise<void> {
  await pilot.emitWithAck('room:choose-seat', { seat: 'pilot' });
  const p1 = onceView(pilot);
  const c1 = onceView(copilot);
  const r1 = await move(pilot, { type: 'confirm' });
  if (r1.ok) {
    await Promise.all([p1.promise, c1.promise]);
  } else {
    p1.cancel();
    c1.cancel();
  }

  const p2 = onceView(pilot);
  const c2 = onceView(copilot);
  const r2 = await move(copilot, { type: 'confirm' });
  if (r2.ok) {
    await Promise.all([p2.promise, c2.promise]);
  } else {
    p2.cancel();
    c2.cancel();
  }
}
