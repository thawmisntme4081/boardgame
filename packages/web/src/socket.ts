import type { ClientEvents, ServerEvents } from '@platform/protocol';
import { io, type Socket } from 'socket.io-client';

/** The platform speaks the generic protocol; each game's payloads are checked by the server. */
export type GameSocket = Socket<
  ServerEvents<string, unknown>,
  ClientEvents<string, unknown, unknown, string>
>;

/** One typed socket for the app. Same origin: Vite proxies `/socket.io` in development. */
export const socket: GameSocket = io({ autoConnect: false });
