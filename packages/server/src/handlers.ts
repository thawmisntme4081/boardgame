import {
  canPlaceDie,
  canUseAbility,
  useAbility,
  canRerollDice,
  canSpendReroll,
  isGameOver,
  placeDie,
  rerollDice,
  expireRoundTimer,
  rollDice,
  startRoundTimer,
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
import { resolveSetup, type Room, type RoomManager, type Seated, type Setup } from './rooms';
import {
  abilitySchema,
  createRoomSchema,
  emptySchema,
  joinRoomSchema,
  placeSchema,
  rejoinRoomSchema,
  rematchSchema,
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

/**
 * Keeps one timeout per room in step with its round deadline: when a timed round runs out,
 * the players lose and everyone gets fresh views. Call after anything that changes the game.
 */
export function syncRoundTimer(io: GameServer, rooms: RoomManager, room: Room): void {
  clearTimeout(room.roundTimer);
  room.roundTimer = undefined;
  const { phase, deadline } = room.game;
  if (phase !== 'placing' || deadline === null) return;
  room.roundTimer = setTimeout(
    () => {
      room.roundTimer = undefined;
      if (rooms.get(room.code) !== room) return; // the room was closed meanwhile
      const next = expireRoundTimer(room.game, Date.now());
      if (next !== room.game) {
        room.game = next;
        broadcastRoom(io, rooms, room);
      } else {
        syncRoundTimer(io, rooms, room); // woke a moment early: wait again
      }
    },
    Math.max(0, deadline - Date.now()),
  );
  room.roundTimer.unref?.();
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

const sameSetup = (room: Room, setup: Setup) =>
  room.game.scenario.id === setup.scenario.id &&
  room.game.abilities.join() === setup.abilities.join();

/** A game that has not started: the rematch someone else already asked for. */
const isFresh = (room: Room) =>
  room.game.phase === 'strategy' &&
  room.game.round === 1 &&
  // The traffic die may already have rolled when the game was created; nothing else has.
  room.game.log.every((event) => event.type === 'traffic');

export function registerHandlers(
  io: GameServer,
  rooms: RoomManager,
  options: HandlerOptions = {},
): void {
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
        // A move that arrives after the round's time ran out finds the game already lost.
        const expired = expireRoundTimer(seated.room.game, Date.now());
        if (expired !== seated.room.game) {
          seated.room.game = expired;
          syncRoundTimer(io, rooms, seated.room);
          broadcastRoom(io, rooms, seated.room);
        }
        const result = handle(parsed.data, seated);
        if (result.ok) {
          rooms.touch(seated.room);
          syncRoundTimer(io, rooms, seated.room);
        }
        reply(result);
        if (result.ok) broadcastRoom(io, rooms, seated.room);
      });

    on('room:create', (payload, reply: (r: JoinResult) => void) => {
      const data = parse(createRoomSchema, payload);
      const setup = data && resolveSetup(data);
      if (!data || !setup) return reply({ ok: false, error: 'bad-request' });
      const result = rooms.create(data.name, socket.id, clientIp(socket, options.trustProxy), {
        timer: data.timer ?? false,
        setup,
      });
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

    on<AckResult>('room:leave', (payload, reply) => {
      if (!emptySchema.safeParse(payload).success) {
        return reply({ ok: false, error: 'bad-request' });
      }
      const left = rooms.leave(socket.id);
      if (!left) return reply({ ok: false, error: 'not-in-room' });
      void socket.leave(left.room.code);
      reply(OK);
      syncRoundTimer(io, rooms, left.room); // the game restarted (or the room closed)
      // The partner sees the empty seat and a fresh game, ready for someone new.
      if (!left.closed) broadcastRoom(io, rooms, left.room);
    });

    onSeated('game:ready', emptySchema, (_data, { room, player }) => {
      if (room.game.phase !== 'strategy') return { ok: false, error: 'not-strategy' };
      player.ready = true;
      if (SEATS.every((seat) => room.players[seat]?.ready)) {
        // Timed games: the round countdown starts with the roll.
        room.game = startRoundTimer(rollDice(room.game), Date.now());
        for (const seat of SEATS) room.players[seat]!.ready = false;
      }
      return OK;
    });

    onSeated('game:place', placeSchema, (intent, { room, player }) => {
      // A double tap sends the same move twice; the repeat is accepted and changes nothing.
      const repeat = room.game.log.some(
        (e) =>
          e.type === 'place' &&
          e.seat === player.seat &&
          e.dieId === intent.dieId &&
          e.slot === intent.slot,
      );
      if (repeat) return OK;
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

    onSeated('game:ability', abilitySchema, (action, { room, player }) => {
      const check = canUseAbility(room.game, player.seat, action);
      if (!check.ok) return { ok: false, error: check.reason };
      room.game = useAbility(room.game, player.seat, action);
      return OK;
    });

    onSeated('game:rematch', rematchSchema, (data = {}, { room }) => {
      const asked = data.scenario !== undefined || data.abilities !== undefined;
      const setup = asked ? resolveSetup(data) : undefined;
      if (asked && !setup) return { ok: false, error: 'bad-request' };
      if (isFresh(room)) {
        // Before the first roll the scenario may still change; the second "Fly again" of a
        // pair finds the new game and changes nothing.
        if (setup && !sameSetup(room, setup)) rooms.rematch(room, setup);
        return OK;
      }
      if (!isGameOver(room.game)) return { ok: false, error: 'game-not-over' };
      rooms.rematch(room, setup);
      return OK;
    });

    socket.on('disconnect', () => {
      const seated = rooms.disconnect(socket.id);
      if (seated) io.to(seated.room.code).emit('room:presence', rooms.presence(seated.room));
    });
  });
}
