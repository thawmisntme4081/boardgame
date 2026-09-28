import {
  canPlaceDie,
  canRerollDice,
  canSpendReroll,
  isGameOver,
  placeDie,
  rerollDice,
  rollDice,
  SEATS,
  spendReroll,
  viewFor,
  type AckResult,
  type ClientToServer,
  type JoinResult,
  type ServerToClient,
} from '@sky/shared';
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import type { Room, RoomManager, Seated } from './rooms';
import {
  chatSchema,
  createRoomSchema,
  emptySchema,
  joinRoomSchema,
  placeSchema,
  rejoinRoomSchema,
  rerollSchema,
} from './schemas';

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

const OK: AckResult = { ok: true };

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

    /**
     * An event from a seated player: parse with Zod, run `handle`, and broadcast fresh
     * views when it succeeds. A failure changes nothing.
     */
    const onSeated = <S extends z.ZodType>(
      event: keyof ClientToServer,
      schema: S,
      handle: (data: z.output<S>, seated: Seated) => AckResult,
    ) =>
      on<AckResult>(event, (payload, reply) => {
        const parsed = schema.safeParse(payload);
        if (!parsed.success) return reply({ ok: false, error: 'bad-request' });
        const seated = rooms.bySocket(socket.id);
        if (!seated) return reply({ ok: false, error: 'not-in-room' });
        const result = handle(parsed.data, seated);
        if (result.ok) rooms.touch(seated.room);
        reply(result);
        if (result.ok) broadcastRoom(io, rooms, seated.room);
      });

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

    onSeated('game:ready', emptySchema, (_data, { room, player }) => {
      if (room.game.phase !== 'strategy') return { ok: false, error: 'not-strategy' };
      player.ready = true;
      if (SEATS.every((seat) => room.players[seat]?.ready)) {
        room.game = rollDice(room.game);
        for (const seat of SEATS) room.players[seat]!.ready = false;
      }
      return OK;
    });

    onSeated('game:place', placeSchema, (intent, { room, player }) => {
      const check = canPlaceDie(room.game, player.seat, intent);
      if (!check.ok) return { ok: false, error: check.reason };
      // Axis, engines and the end of the round (landing included) resolve inside placeDie.
      room.game = placeDie(room.game, player.seat, intent);
      return OK;
    });

    onSeated('game:spend-reroll', emptySchema, (_data, { room, player }) => {
      const check = canSpendReroll(room.game);
      if (!check.ok) return { ok: false, error: check.reason };
      room.game = spendReroll(room.game, player.seat);
      return OK;
    });

    onSeated('game:reroll', rerollSchema, ({ dieIds }, { room, player }) => {
      const check = canRerollDice(room.game, player.seat, dieIds);
      if (!check.ok) return { ok: false, error: check.reason };
      room.game = rerollDice(room.game, player.seat, dieIds);
      return OK;
    });

    onSeated('game:rematch', emptySchema, (_data, { room }) => {
      if (!isGameOver(room.game)) return { ok: false, error: 'game-not-over' };
      rooms.rematch(room);
      return OK;
    });

    // Chat is not game state: no fresh views, just the message to both players.
    on<AckResult>('chat:send', (payload, reply) => {
      const data = parse(chatSchema, payload);
      if (!data) return reply({ ok: false, error: 'bad-request' });
      const seated = rooms.bySocket(socket.id);
      if (!seated) return reply({ ok: false, error: 'not-in-room' });
      const { room, player } = seated;
      // The no-talking rule: silence from the roll until the round ends.
      if (room.game.phase === 'placing') return reply({ ok: false, error: 'chat-locked' });
      rooms.touch(room);
      reply(OK);
      io.to(room.code).emit('chat:message', {
        seat: player.seat,
        name: player.name,
        text: data.text,
        at: Date.now(),
      });
    });

    socket.on('disconnect', () => {
      const seated = rooms.disconnect(socket.id);
      if (seated) io.to(seated.room.code).emit('room:presence', rooms.presence(seated.room));
    });
  });
}
