import {
  rollDice,
  SEATS,
  viewFor,
  type AckResult,
  type ClientToServer,
  type JoinResult,
  type ServerToClient,
} from '@sky/shared';
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import type { Room, RoomManager, Seated } from './rooms';
import { createRoomSchema, joinRoomSchema, readySchema, rejoinRoomSchema } from './schemas';

export type GameServer = Server<ClientToServer, ServerToClient>;
type GameSocket = Socket<ClientToServer, ServerToClient>;

/** Sends presence to the room, then each seat its own filtered view. */
export function broadcastRoom(io: GameServer, rooms: RoomManager, room: Room): void {
  io.to(room.code).emit('room:presence', rooms.presence(room));
  for (const seat of SEATS) {
    const socketId = room.players[seat]?.socketId;
    if (socketId) io.to(socketId).emit('game:view', viewFor(room.game, seat));
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

const joined = ({ room, player }: Seated): JoinResult => ({
  ok: true,
  code: room.code,
  seat: player.seat,
  token: player.token,
});

export function registerHandlers(io: GameServer, rooms: RoomManager): void {
  io.on('connection', (socket: GameSocket) => {
    /** Wraps a handler so a bug answers `bad-request` instead of crashing the process. */
    const on = <R extends JoinResult | AckResult>(
      event: keyof ClientToServer,
      handle: (payload: unknown, reply: (result: R) => void) => void,
    ) => {
      // Payloads are validated at runtime, so the typed signature is widened here.
      socket.on(event, ((payload: unknown, ack: unknown) => {
        const reply = replier<R>(ack);
        try {
          handle(payload, reply);
        } catch (error) {
          console.error(`[${event}] handler failed`, error);
          reply({ ok: false, error: 'bad-request' } as R);
        }
      }) as never);
    };

    on('room:create', (payload, reply: (r: JoinResult) => void) => {
      const data = parse(createRoomSchema, payload);
      if (!data) return reply({ ok: false, error: 'bad-request' });
      const result = rooms.create(data.name, socket.id);
      if (!result.ok) return reply(result);
      void socket.join(result.value.room.code);
      reply(joined(result.value));
      broadcastRoom(io, rooms, result.value.room);
    });

    on('room:join', (payload, reply: (r: JoinResult) => void) => {
      const data = parse(joinRoomSchema, payload);
      if (!data) return reply({ ok: false, error: 'bad-request' });
      const result = rooms.join(data.code, data.name, socket.id);
      if (!result.ok) return reply(result);
      void socket.join(result.value.room.code);
      reply(joined(result.value));
      broadcastRoom(io, rooms, result.value.room);
    });

    on('room:rejoin', (payload, reply: (r: JoinResult) => void) => {
      const data = parse(rejoinRoomSchema, payload);
      if (!data) return reply({ ok: false, error: 'bad-request' });
      const previous = rooms.get(data.code);
      const oldSocketId = previous
        ? SEATS.map((s) => previous.players[s]).find((p) => p?.token === data.token)?.socketId
        : undefined;
      const result = rooms.rejoin(data.code, data.token, socket.id);
      if (!result.ok) return reply(result);
      // A stale connection for the same seat stops receiving room traffic.
      if (oldSocketId && oldSocketId !== socket.id) io.in(oldSocketId).socketsLeave(data.code);
      void socket.join(data.code);
      reply(joined(result.value));
      broadcastRoom(io, rooms, result.value.room);
    });

    on('game:ready', (payload, reply: (r: AckResult) => void) => {
      if (!readySchema.safeParse(payload).success) {
        return reply({ ok: false, error: 'bad-request' });
      }
      const seated = rooms.bySocket(socket.id);
      if (!seated) return reply({ ok: false, error: 'not-in-room' });
      const { room, player } = seated;
      if (room.game.phase !== 'strategy') return reply({ ok: false, error: 'not-strategy' });

      player.ready = true;
      rooms.touch(room);
      const allReady = SEATS.every((seat) => room.players[seat]?.ready);
      if (allReady) {
        room.game = rollDice(room.game);
        for (const seat of SEATS) room.players[seat]!.ready = false;
      }
      reply({ ok: true });
      broadcastRoom(io, rooms, room);
    });

    socket.on('disconnect', () => {
      const seated = rooms.disconnect(socket.id);
      if (seated) io.to(seated.room.code).emit('room:presence', rooms.presence(seated.room));
    });
  });
}
