import {
  ROUND_TIMER_MS,
  YUL,
  type AckResult,
  type ClientToServer,
  type JoinResult,
  type Presence,
  type Seat,
  type ServerToClient,
} from '@sky/shared';
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import { game, type GameConfig, type GameMove } from './games';
import { log, reportError } from './log';
import type { Room, RoomManager, Seated } from './rooms';
import {
  chooseSeatSchema,
  createRoomSchema,
  emptySchema,
  joinRoomSchema,
  rejoinRoomSchema,
  rematchSchema,
} from './schemas';

export type GameServer = Server<ClientToServer, ServerToClient>;
type GameSocket = Socket<ClientToServer, ServerToClient>;

/**
 * Sends each seat its presence (marked with its seat), then its own filtered view. Every
 * accepted change ends here, so this is also where the room is saved (off the reply path)
 * and the timer for the game's next scheduled move is armed.
 */
export function broadcastRoom(io: GameServer, rooms: RoomManager, room: Room): void {
  rooms.save(room);
  rooms.arm(room);
  const presence = rooms.presence(room) as Presence;
  const now = Date.now();
  for (const seat of game.meta.seats) {
    const socketId = room.players[seat]?.socketId;
    if (!socketId) continue;
    io.to(socketId).emit('room:presence', { ...presence, you: seat as Seat });
    io.to(socketId).emit('game:view', game.view(room.game, seat, now));
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
  seat: player.seat as Seat,
  token: player.token,
});

const OK: AckResult = { ok: true };
const refused = (error: string): AckResult => ({ ok: false, error }) as AckResult;

export interface HandlerOptions {
  /** Behind a proxy (Render, Railway, Fly), read the client IP from X-Forwarded-For. */
  trustProxy?: boolean;
  /** Length of a timed round (tests and dev shorten it). */
  roundTimerMs?: number;
  /** Total Trust: the pause before the server rolls (tests shorten it). */
  autoRollDelayMs?: number;
}

/** The address used for the per-IP room limit. */
export function clientIp(socket: GameSocket, trustProxy = false): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return (trustProxy && first) || socket.handshake.address || 'unknown';
}

/** A game that has not started: the rematch someone else already asked for. */
const isFresh = (room: Room) => room.game.phase === 'setup';

/** The Sky Team events that are game moves: `game:<type>` with the move's fields. */
const MOVE_EVENTS = [
  'game:ready',
  'game:pick-ability',
  'game:confirm',
  'game:place',
  'game:spend-reroll',
  'game:reroll',
  'game:ability',
  'game:cancel-swap',
] as const satisfies readonly (keyof ClientToServer)[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function registerHandlers(
  io: GameServer,
  rooms: RoomManager,
  options: HandlerOptions = {},
): void {
  const roundTimerMs = options.roundTimerMs ?? ROUND_TIMER_MS;
  /** The lobby's choices as the game's setup, checked by its `configSchema`. */
  const configFor = (
    request: { scenario?: string | undefined; timer?: boolean | undefined },
    base?: GameConfig,
  ): GameConfig | undefined => {
    const parsed = game.configSchema.safeParse({
      ...base,
      scenario: request.scenario ?? base?.scenario ?? YUL.id,
      ...(request.timer !== undefined && { timerMs: request.timer ? roundTimerMs : null }),
      ...(options.autoRollDelayMs && { autoRollDelayMs: options.autoRollDelayMs }),
    });
    return parsed.success ? parsed.data : undefined;
  };

  // A scheduled move (time up, Total Trust's roll) changed a game: everyone sees it.
  rooms.onScheduled = (room) => broadcastRoom(io, rooms, room);

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
          log.error({ event, err: error }, 'handler failed');
          reportError(error);
          reply({ ok: false, error: 'bad-request' } as R);
        }
      }) as never);
    };

    /**
     * An event from a seated player: parse it, run `handle`, and broadcast fresh views when
     * it succeeds. A failure changes nothing.
     */
    const onSeated = <T>(
      event: keyof ClientToServer,
      parsePayload: (payload: unknown) => T | undefined,
      handle: (data: T, seated: Seated) => AckResult,
    ) =>
      on<AckResult>(event, (payload, reply) => {
        const data = parsePayload(payload);
        if (data === undefined) return reply({ ok: false, error: 'bad-request' });
        const seated = rooms.bySocket(socket.id);
        if (!seated) return reply({ ok: false, error: 'not-in-room' });
        const { room } = seated;
        // A move that arrives after the round's time ran out finds the game already lost.
        if (rooms.runDue(room).length > 0) broadcastRoom(io, rooms, room);
        const wasOver = game.outcome(room.game) !== null;
        const result = handle(data, seated);
        const where = { event, room: room.code, seat: seated.player.seat };
        if (!result.ok) log.info({ ...where, error: result.error }, 'move rejected');
        if (result.ok) {
          rooms.touch(room);
          const outcome = game.outcome(room.game);
          if (!wasOver && outcome) {
            log.info(
              { ...where, scenario: room.config.scenario, outcome, round: room.game.round },
              'game ended',
            );
          }
        }
        reply(result);
        if (result.ok) broadcastRoom(io, rooms, room);
      });

    on('room:create', (payload, reply: (r: JoinResult) => void) => {
      const data = parse(createRoomSchema, payload);
      const config = data && configFor({ ...data, timer: data.timer ?? false });
      if (!data || !config) return reply({ ok: false, error: 'bad-request' });
      const result = rooms.create(
        data.name,
        socket.id,
        clientIp(socket, options.trustProxy),
        config,
      );
      if (!result.ok) return reply(result);
      void socket.join(result.value.room.code);
      reply(joined(result.value));
      log.info(
        { room: result.value.room.code, scenario: config.scenario, timer: config.timerMs !== null },
        'room created',
      );
      broadcastRoom(io, rooms, result.value.room);
    });

    on('room:join', (payload, reply: (r: JoinResult) => void) => {
      const data = parse(joinRoomSchema, payload);
      if (!data) return reply({ ok: false, error: 'bad-request' });
      const result = rooms.join(data.code, data.name, socket.id);
      if (!result.ok) return reply(result);
      void socket.join(result.value.room.code);
      reply(joined(result.value));
      log.info({ room: result.value.room.code, seat: result.value.player.seat }, 'room joined');
      broadcastRoom(io, rooms, result.value.room);
    });

    on('room:rejoin', (payload, reply: (r: JoinResult) => void) => {
      const data = parse(rejoinRoomSchema, payload);
      if (!data) return reply({ ok: false, error: 'bad-request' });
      const previous = rooms.get(data.code);
      const oldSocketId = previous
        ? Object.values(previous.players).find((p) => p?.token === data.token)?.socketId
        : undefined;
      const result = rooms.rejoin(data.code, data.token, socket.id);
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
      // The partner sees the empty seat and a fresh game, ready for someone new.
      if (!left.closed) broadcastRoom(io, rooms, left.room);
    });

    onSeated(
      'room:choose-seat',
      (payload) => parse(chooseSeatSchema, payload),
      ({ seat }, { room, player }) => {
        const result = rooms.chooseSeat(room, player, seat);
        return result.ok ? OK : refused(result.error);
      },
    );

    // Every game event is a move: its payload plus the event's name as the type.
    for (const event of MOVE_EVENTS) {
      const type = event.slice('game:'.length);
      onSeated(
        event,
        (payload) => {
          if (payload !== undefined && !isRecord(payload)) return undefined;
          const parsed = game.moveSchema.safeParse({ ...payload, type });
          return parsed.success ? (parsed.data as GameMove) : undefined;
        },
        (move, { room, player }) => {
          if (move.type === 'place' && isRepeat(room, player.seat, move)) return OK;
          const result = rooms.move(room, player.seat, move);
          return result.ok ? OK : refused(result.error);
        },
      );
    }

    onSeated(
      'game:rematch',
      (payload) => {
        const parsed = rematchSchema.safeParse(payload);
        return parsed.success ? (parsed.data ?? {}) : undefined;
      },
      (data, { room }) => {
        const asked = data.scenario !== undefined;
        const config = asked ? configFor(data, room.config) : undefined;
        if (asked && !config) return { ok: false, error: 'bad-request' };
        if (isFresh(room)) {
          // Before the first roll the scenario may still change; the second "Fly again" of a
          // pair finds the new game and changes nothing.
          if (config && config.scenario !== room.config.scenario) rooms.rematch(room, config);
          return OK;
        }
        if (game.outcome(room.game) === null) return { ok: false, error: 'game-not-over' };
        rooms.rematch(room, config);
        return OK;
      },
    );

    socket.on('disconnect', () => {
      const seated = rooms.disconnect(socket.id);
      if (seated)
        io.to(seated.room.code).emit('room:presence', rooms.presence(seated.room) as Presence);
    });
  });
}

/** A double tap sends the same die twice; the repeat is accepted and changes nothing. */
function isRepeat(room: Room, seat: string, move: Extract<GameMove, { type: 'place' }>): boolean {
  return room.game.log.some(
    (e) => e.type === 'place' && e.seat === seat && e.dieId === move.dieId && e.slot === move.slot,
  );
}
