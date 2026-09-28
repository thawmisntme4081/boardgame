import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { registerHandlers, type GameServer } from './handlers';
import { RoomManager } from './rooms';

/** Express + Socket.IO on one HTTP server. Not listening yet, so tests can pick a port. */
export function createGameServer(rooms = new RoomManager()) {
  const app = express();

  app.get('/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  const httpServer = createServer(app);
  const io: GameServer = new Server(httpServer);
  registerHandlers(io, rooms);

  return { app, httpServer, io, rooms };
}
