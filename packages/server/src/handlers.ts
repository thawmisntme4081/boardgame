// The socket gateway: the platform's `room:*` events and the games' `match:move`, for every
// game alike. Payloads are checked with the protocol's schemas, moves with the game's
// `moveSchema`; the game rules are only ever reached through `RoomManager`.
import {
  chooseSeatSchema,
  createRoomSchema,
  emptySchema,
  joinRoomSchema,
  moveSchema,
  rejoinRoomSchema,
  rematchSchema,
  type AckResult,
  type ClientEvents,
  type JoinResult,
  type Presence,
  type ServerEvents,
} from '@platform/protocol';
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import type { GameMove } from './games';
import { log, reportError } from './log';
import type { Room, RoomManager, Seated } from './rooms';

type Events = ClientEvents<string, unknown, unknown, string>;
export type GameServer = Server<Events, ServerEvents<string, unknown>>;
type GameSocket = Socket<Events, ServerEvents<string, unknown>>;

/**
 * Sends each seat its presence (marked with its seat), then its own view of the match. Every
 * accepted change ends here, so this is also where the room is saved (off the reply path)
 * and the timer for the game's next scheduled move is armed.
 */
export function broadcastRoom(io: GameServer, rooms: RoomManager, room: Room): void {
  rooms.save(room);
  rooms.arm(room);
  const { definition } = rooms.entry(room);
  const presence = rooms.presence(room) as Presence;
  const { id: matchId, version } = room.match;
  const now = Date.now();
  for (const seat of definition.meta.seats) {
    const socketId = room.players[seat]?.socketId;
    if (!socketId) continue;
    io.to(socketId).emit('room:presence', { ...presence, you: seat } as Presence);
    io.to(socketId).emit('match:view', {
      matchId,
      version,
      seat,
      view: definition.view(room.game, seat, now),
    });
  }
}

/** Clients may omit the ack or send junk; never let that throw. */
function replier<R>(ack: unknown): (result: R) => void {
  return typeof ack === 'function' ? (ack as (result: R) => void) : () => {};
}

function parse<S extends z.ZodType>(schema: S, payload: unknown): z.output<S> | undefined {
  const parsed = schema.safeParse(payload);
  return parsed.success ? parsed.data : undefined;
}

const joined = ({ room, player, token }: Seated): JoinResult => ({
  ok: true,
  code: room.code,
  game: room.gameId,
  seat: player.seat,
  token: token ?? '',
  matchId: room.match.id,
  seq: player.seq,
});

const OK: AckResult = { ok: true };

export interface HandlerOptions {
  /** Behind a proxy (Render, Railway, Fly), read the client IP from X-Forwarded-For. */
  trustProxy?: boolean;
}

/** The address used for the per-IP room limit. */
export function clientIp(socket: GameSocket, trustProxy = false): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return (trustProxy && first) || socket.handshake.address || 'unknown';
}

/** What the handshake learned about a connection (`app.ts`): the signed-in account, if any. */
export interface SocketData {
  userId?: string;
}

export function registerHandlers(
  io: GameServer,
  rooms: RoomManager,
  options: HandlerOptions = {},
): void {
  // A scheduled move (time up, an automatic roll) changed a game: everyone sees it.
  rooms.onScheduled = (room) => broadcastRoom(io, rooms, room);

  io.on('connection', (socket: GameSocket) => {
    // Read once at the handshake: signing in or out makes the client reconnect.
    const { userId } = socket.data as SocketData;

    /** Wraps a handler so a bug answers `bad-request` instead of crashing the process. */
    const on = <R extends JoinResult | AckResult>(
      event: keyof Events,
      handle: (payload: unknown, reply: (result: R) => void) => void,
    ) => {
      // Payloads are validated at runtime, so the typed signature is widened here.
      socket.on(event, ((payload: unknown, ack: unknown) => {
        const reply = replier<R>(ack);
        try {
          handle(payload, reply);
        } catch (error) {
          log.error({ event, err: error }, 'handler failed');
          reportError(error);
          reply({ ok: false, error: 'bad-request' } as R);
        }
      }) as never);
    };

    /**
     * An event from a seated player: parse it, make the game's due scheduled moves, run
     * `handle`, and broadcast fresh views when it succeeds. A failure changes nothing.
     */
    const onSeated = <S extends z.ZodType>(
      event: keyof Events,
      schema: S,
      handle: (data: z.output<S>, seated: Seated) => AckResult,
    ) =>
      on<AckResult>(event, (payload, reply) => {
        const parsed = schema.safeParse(payload);
        if (!parsed.success) return reply({ ok: false, error: 'bad-request' });
        const seated = rooms.bySocket(socket.id);
        if (!seated) return reply({ ok: false, error: 'not-in-room' });
        const { room } = seated;
        const { definition } = rooms.entry(room);
        // A move that arrives after the round's time ran out finds the game already lost.
        if (rooms.runDue(room).length > 0) broadcastRoom(io, rooms, room);
        const wasOver = definition.outcome(room.game) !== null;
        const result = handle(parsed.data, seated);
        const where = { event, room: room.code, seat: seated.player.seat };
        if (!result.ok) log.info({ ...where, error: result.error }, 'request refused');
        if (result.ok) {
          rooms.touch(room);
          const outcome = definition.outcome(room.game);
          if (!wasOver && outcome) {
            log.info({ ...where, game: room.gameId, match: room.match.id, outcome }, 'game ended');
          }
        }
        reply(result);
        if (result.ok) broadcastRoom(io, rooms, room);
      });

    on('room:create', (payload, reply: (r: JoinResult) => void) => {
      const data = parse(createRoomSchema, payload);
      if (!data) return reply({ ok: false, error: 'bad-request' });
      const result = rooms.create(data.name, socket.id, clientIp(socket, options.trustProxy), {
        game: data.game,
        config: data.config,
        userId,
      });
      if (!result.ok) return reply(result);
      const { room } = result.value;
      void socket.join(room.code);
      reply(joined(result.value));
      log.info({ room: room.code, game: room.gameId, config: room.config }, 'room created');
      broadcastRoom(io, rooms, room);
    });

    on('room:join', (payload, reply: (r: JoinResult) => void) => {
      const data = parse(joinRoomSchema, payload);
      if (!data) return reply({ ok: false, error: 'bad-request' });
      const result = rooms.join(data.code, data.name, socket.id, userId);
      if (!result.ok) return reply(result);
      const { room, player, replaced } = result.value;
      // Signed in and already seated here: the seat moved to this connection.
      if (replaced) io.in(replaced).socketsLeave(room.code);
      void socket.join(room.code);
      reply(joined(result.value));
      log.info({ room: room.code, seat: player.seat, account: Boolean(userId) }, 'room joined');
      broadcastRoom(io, rooms, room);
    });

    on('room:resume', (payload, reply: (r: JoinResult) => void) => {
      if (!emptySchema.safeParse(payload).success) {
        return reply({ ok: false, error: 'bad-request' });
      }
      if (!userId) return reply({ ok: false, error: 'not-in-room' });
      const result = rooms.resume(userId, socket.id);
      if (!result.ok) return reply(result);
      const { room, player, replaced } = result.value;
      if (replaced) io.in(replaced).socketsLeave(room.code);
      void socket.join(room.code);
      reply(joined(result.value));
      log.info({ room: room.code, seat: player.seat }, 'seat resumed by account');
      broadcastRoom(io, rooms, room);
    });

    on('room:rejoin', (payload, reply: (r: JoinResult) => void) => {
      const data = parse(rejoinRoomSchema, payload);
      if (!data) return reply({ ok: false, error: 'bad-request' });
      const oldSocketId = rooms.seatOf(data.code, data.token)?.socketId;
      const result = rooms.rejoin(data.code, data.token, socket.id, userId);
      if (!result.ok) return reply(result);
      // A stale connection for the same seat stops receiving room traffic.
      if (oldSocketId && oldSocketId !== socket.id) io.in(oldSocketId).socketsLeave(data.code);
      void socket.join(data.code);
      reply(joined(result.value));
      log.info({ room: data.code, seat: result.value.player.seat }, 'seat rejoined');
      broadcastRoom(io, rooms, result.value.room);
    });

    on<AckResult>('room:leave', (payload, reply) => {
      if (!emptySchema.safeParse(payload).success) {
        return reply({ ok: false, error: 'bad-request' });
      }
      const left = rooms.leave(socket.id);
      if (!left) return reply({ ok: false, error: 'not-in-room' });
      void socket.leave(left.room.code);
      reply(OK);
      log.info({ room: left.room.code, seat: left.player.seat, closed: left.closed }, 'seat left');
      // The partner sees the empty seat and a fresh match, ready for someone new.
      if (!left.closed) broadcastRoom(io, rooms, left.room);
    });

    onSeated('room:choose-seat', chooseSeatSchema, ({ seat }, { room, player }) => {
      const result = rooms.chooseSeat(room, player, seat);
      return result.ok ? OK : { ok: false, error: result.error };
    });

    onSeated('room:rematch', rematchSchema, ({ matchId, config }, { room }) => {
      const result = rooms.requestRematch(room, matchId, config);
      return result.ok ? OK : { ok: false, error: result.error };
    });

    onSeated('match:move', moveSchema, ({ matchId, seq, move }, { room, player }) => {
      if (matchId !== room.match.id) return { ok: false, error: 'stale-match' };
      const parsed = rooms.entry(room).definition.moveSchema.safeParse(move);
      if (!parsed.success) return { ok: false, error: 'bad-request' };
      const result = rooms.play(room, player, seq, parsed.data as GameMove);
      return result.ok ? OK : { ok: false, error: result.error };
    });

    socket.on('disconnect', () => {
      const seated = rooms.disconnect(socket.id);
      if (seated) {
        io.to(seated.room.code).emit('room:presence', rooms.presence(seated.room) as Presence);
      }
    });
  });
}
