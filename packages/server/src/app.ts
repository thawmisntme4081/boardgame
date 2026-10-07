import { existsSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import path from 'node:path';
import { armAutoRoll, type GameState } from '@sky/rules';
import express from 'express';
import { Server } from 'socket.io';
import type { AccessCheck } from './access';
import { AUTH_BASE_PATH, type Accounts } from './accounts';
import {
  broadcastRoom,
  registerHandlers,
  type GameServer,
  type HandlerOptions,
  type SocketData,
} from './handlers';
import { log, reportError } from './log';
import { RoomManager } from './rooms';
import type { SiteGate } from './siteGate';

export interface ServerOptions extends HandlerOptions {
  /** How often idle rooms are swept; 0 turns the sweep off (tests call `rooms.sweep()`). */
  sweepIntervalMs?: number;
  /** Built client (`packages/web/dist`) to serve, with `index.html` for any other page. */
  clientDir?: string;
  /**
   * Test-only routes for end-to-end tests (set up a game state). Never enable in
   * production: they let anyone rewrite a game.
   */
  e2eHooks?: boolean;
  /**
   * The private site's login gate (Cloudflare Access): pages and socket connections without
   * a valid Access token are refused. `/health` and `/robots.txt` stay open.
   */
  accessCheck?: AccessCheck;
  /**
   * The private site's shared password (`SITE_PASSWORD`): socket connections need the
   * cookie a correct password gives. Pages load for anyone; they hold no game data.
   */
  siteGate?: SiteGate;
  /**
   * Optional accounts (sign in with Google or an email code): `/api/auth/*` and
   * `GET /auth/me`. Behind the site password when there is one.
   */
  accounts?: Accounts;
}

/** Express + Socket.IO on one HTTP server. Not listening yet, so tests can pick a port. */
export function createGameServer(rooms = new RoomManager(), options: ServerOptions = {}) {
  const app = express();

  // A private site: search engines must not list it, whatever address they find.
  app.use((_req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send('User-agent: *\nDisallow: /\n');
  });

  const { accessCheck } = options;
  if (accessCheck) {
    app.use((req, res, next) => {
      void accessCheck(req).then((ok) => (ok ? next() : res.status(403).send('Forbidden')));
    });
  }

  // The password screen asks here first; without a site password the gate is open.
  const { siteGate } = options;
  if (siteGate) app.use(siteGate.router);
  else app.get('/auth/status', (_req, res) => void res.json({ gate: false, ok: true }));

  const { accounts } = options;
  if (accounts) {
    // Signing in comes after the site password: without it, no accounts and no code emails.
    if (siteGate) {
      app.use(
        [
          AUTH_BASE_PATH,
          '/auth/me',
          '/auth/methods',
          '/auth/name',
          '/api/flight-log',
          '/api/flight-log/import',
        ],
        (req, res, next) => {
          if (siteGate.check(req)) next();
          else res.status(401).json({ error: 'site-password' });
        },
      );
    }
    app.use(accounts.router);
    // A device's own games from before it signed in, joined to the account's log.
    app.post('/api/flight-log/import', express.json({ limit: '512kb' }), (req, res) => {
      const body = req.body as { game?: unknown; records?: unknown } | undefined;
      const records = body?.records;
      if (typeof body?.game !== 'string' || !Array.isArray(records) || records.length > 500) {
        return void res.status(400).json({ error: 'bad-request' });
      }
      const game = body.game;
      accounts.userOf(req).then(
        (user) => {
          if (!user) return void res.status(401).json({ error: 'signed-out' });
          const count = rooms.importFlightLog(user.id, game, records as unknown[]);
          if (count === undefined) return void res.status(400).json({ error: 'bad-request' });
          res.json({ imported: count });
        },
        (error: unknown) => {
          reportError(error);
          res.status(500).json({ error: 'unknown' });
        },
      );
    });
    // The signed-in account's own records for a game, `?game=<id>`: nobody else's.
    app.get('/api/flight-log', (req, res) => {
      const game = typeof req.query.game === 'string' ? req.query.game : '';
      accounts.userOf(req).then(
        (user) =>
          user
            ? res.json(rooms.flightLog(user.id, game))
            : void res.status(401).json({ error: 'signed-out' }),
        (error: unknown) => {
          reportError(error);
          res.status(500).json({ error: 'unknown' });
        },
      );
    });
  }

  // The socket handshake is an HTTP request too: it needs every gate that is on.
  const gates: ((req: IncomingMessage) => boolean | Promise<boolean>)[] = [];
  if (accessCheck) gates.push(accessCheck);
  if (siteGate) gates.push((req) => siteGate.check(req));

  const httpServer = createServer(app);
  const io: GameServer = new Server(httpServer, {
    ...(gates.length > 0 && {
      allowRequest: (req, callback) => {
        void Promise.all(gates.map((gate) => gate(req))).then((results) => {
          const ok = results.every(Boolean);
          callback(ok ? null : 'forbidden', ok);
        });
      },
    }),
  });
  // Signed in? The handshake carries the session cookie: the socket knows its account (or
  // none; a failed lookup counts as a guest). Signing in or out makes the client reconnect.
  if (accounts) {
    io.use((socket, next) => {
      accounts.userOf(socket.request).then(
        (user) => {
          (socket.data as SocketData).userId = user?.id;
          next();
        },
        (error: unknown) => {
          reportError(error);
          next();
        },
      );
    });
  }
  registerHandlers(io, rooms, options);
  // Rooms loaded from the store: re-arm their scheduled moves (round timers, Total Trust
  // rolls). A deadline that passed while the server was down expires at once.
  for (const room of rooms.all()) rooms.arm(room);

  if (options.e2eHooks) {
    // Merges a partial game state into a room, then sends everyone fresh views. Test-only, and
    // Sky Team's state shape: the E2E tests only play Sky Team.
    app.post('/__e2e/rooms/:code/game', express.json(), (req, res) => {
      const room = rooms.get(req.params.code);
      if (!room) return void res.status(404).json({ ok: false });
      // A prepared Total Trust strategy phase still rolls by itself.
      const patched = { ...room.game, ...(req.body as Partial<GameState>) };
      rooms.replaceGame(room, armAutoRoll(patched, Date.now()));
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
      if (removed.length > 0) log.info({ rooms: removed }, 'idle rooms removed');
    }, sweepMs);
    timer.unref();
    httpServer.on('close', () => clearInterval(timer));
  }

  return { app, httpServer, io, rooms };
}
