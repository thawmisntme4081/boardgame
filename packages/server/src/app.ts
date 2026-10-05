import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import type { GameState } from '@sky/shared';
import express from 'express';
import { Server } from 'socket.io';
import {
  broadcastRoom,
  registerHandlers,
  syncRoundTimer,
  type GameServer,
  type HandlerOptions,
} from './handlers';
import { RoomManager } from './rooms';

export interface ServerOptions extends HandlerOptions {
  /** How often idle rooms are swept; 0 turns the sweep off (tests call `rooms.sweep()`). */
  sweepIntervalMs?: number;
  /** Built client (`packages/client/dist`) to serve, with `index.html` for any other page. */
  clientDir?: string;
  /**
   * Test-only routes for end-to-end tests (set up a game state). Never enable in
   * production: they let anyone rewrite a game.
   */
  e2eHooks?: boolean;
}

/** Express + Socket.IO on one HTTP server. Not listening yet, so tests can pick a port. */
export function createGameServer(rooms = new RoomManager(), options: ServerOptions = {}) {
  const app = express();

  app.get('/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  const httpServer = createServer(app);
  const io: GameServer = new Server(httpServer);
  registerHandlers(io, rooms, options);
  // Rooms loaded from the store: re-arm their round timers and Total Trust rolls. A deadline
  // that passed while the server was down expires at once.
  for (const room of rooms.all()) syncRoundTimer(io, rooms, room);

  if (options.e2eHooks) {
    // Merges a partial game state into a room, then sends everyone fresh views.
    app.post('/__e2e/rooms/:code/game', express.json(), (req, res) => {
      const room = rooms.get(req.params.code);
      if (!room) return void res.status(404).json({ ok: false });
      room.game = { ...room.game, ...(req.body as Partial<GameState>) };
      syncRoundTimer(io, rooms, room);
      broadcastRoom(io, rooms, room);
      res.json({ ok: true });
    });
  }

  const { clientDir } = options;
  if (clientDir && existsSync(path.join(clientDir, 'index.html'))) {
    app.use(express.static(clientDir));
    // Invite links like /r/ABCD are client routes: answer them with the app.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || !req.accepts('html')) return next();
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  const sweepMs = options.sweepIntervalMs ?? 60_000;
  if (sweepMs > 0) {
    const timer = setInterval(() => {
      const removed = rooms.sweep();
      if (removed.length > 0) console.log(`removed idle rooms: ${removed.join(', ')}`);
    }, sweepMs);
    timer.unref();
    httpServer.on('close', () => clearInterval(timer));
  }

  return { app, httpServer, io, rooms };
}
