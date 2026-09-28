import type { ClientToServer, ServerToClient } from '@sky/shared';
import { io, type Socket } from 'socket.io-client';

export type GameSocket = Socket<ServerToClient, ClientToServer>;

/** One typed socket for the app. Same origin: Vite proxies `/socket.io` in development. */
export const socket: GameSocket = io({ autoConnect: false });
