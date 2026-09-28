import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { registerHandlers, type GameServer, type HandlerOptions } from './handlers';
import { RoomManager } from './rooms';

export interface ServerOptions extends HandlerOptions {
  /** How often idle rooms are swept; 0 turns the sweep off (tests call `rooms.sweep()`). */
  sweepIntervalMs?: number;
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
