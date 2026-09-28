// Helpers for integration tests: a real server on a random port and typed clients.
import type { AddressInfo } from 'node:net';
import type { ClientToServer, ServerToClient } from '@sky/shared';
import { io as connectClient, type Socket } from 'socket.io-client';
import { createGameServer } from './app';
import type { RoomManager } from './rooms';

export type Client = Socket<ServerToClient, ClientToServer>;

export async function startTestServer(rooms?: RoomManager) {
  const server = createGameServer(rooms);
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  const { port } = server.httpServer.address() as AddressInfo;
  const url = `http://localhost:${port}`;
  const clients: Client[] = [];

  return {
    ...server,
    url,
    async connect(): Promise<Client> {
      const socket: Client = connectClient(url, { transports: ['websocket'], forceNew: true });
      clients.push(socket);
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
