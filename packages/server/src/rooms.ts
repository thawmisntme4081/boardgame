import { randomInt, randomUUID } from 'node:crypto';
import {
  nextDue,
  runDue,
  type Mover,
  type PlayedMove,
  type SeatId,
  type TableMove,
} from '@platform/engine';
import { ROOM_CODE_LENGTH, type PlatformError, type SeatInfo } from '@platform/protocol';
import {
  configFor,
  createRegistry,
  type GameConfig,
  type GameEntry,
  type GameMove,
  type GameRegistry,
  type GameSettings,
  type GameState,
} from './games';
import { fromStored, toStored, type RoomStore } from './store';

/** No I or O, so codes can't be misread as 1 or 0. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** The game a room plays when `room:create` names none (the only one so far). */
export const DEFAULT_GAME = 'sky-team';

export interface Player {
  seat: SeatId;
  name: string;
  token: string;
  socketId: string | null;
  /** Created the room (or stayed when the creator left): runs the setup. */
  creator: boolean;
  /** The last `match:move` counter accepted from this player in the current match. */
  seq: number;
}

/** The game being played in a room. A rematch starts a new match in the same room. */
export interface Match {
  /** `<room code>-<number>`: a move or rematch for another match is refused or ignored. */
  id: string;
  number: number;
  /** Accepted changes so far: views carry it, so a client drops older ones. */
  version: number;
}

export interface Room {
  code: string;
  /** The game's id in the registry. */
  gameId: string;
  players: Partial<Record<SeatId, Player>>;
  /** The setup of the current match; a rematch starts from it. */
  config: GameConfig;
  match: Match;
  game: GameState;
  /** Counted against the per-IP room limit while the room exists. */
  creatorIp: string;
  createdAt: number;
  lastActivity: number;
  /** The armed timer for the game's next scheduled move (never saved; see `arm`). */
  timer?: ReturnType<typeof setTimeout>;
}

export interface RoomOptions {
  now?: () => number;
  seed?: () => number;
  /** Rooms with nobody connected are removed after this long without activity. */
  idleTtlMs?: number;
  /** Live rooms one IP address may have created at once. */
  maxRoomsPerIp?: number;
  /** The server's own settings per game (shorter timers in tests and dev). */
  settings?: GameSettings;
  /**
   * Where rooms are kept between restarts (SQLite in production). Without one, rooms live
   * in memory only and a restart ends every game.
   */
  store?: RoomStore;
}

export const DEFAULT_IDLE_TTL_MS = 30 * 60_000;
export const DEFAULT_MAX_ROOMS_PER_IP = 5;

export interface Seated {
  room: Room;
  player: Player;
}

/** A refusal: a platform code, or the game's own reason for refusing a move. */
export type Result<T, E = PlatformError> = { ok: true; value: T } | { ok: false; error: E };

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const matchId = (code: string, number: number) => `${code}-${number}`;

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  /** Which room and seat each connected socket occupies. */
  private readonly sockets = new Map<string, { code: string; seat: SeatId }>();

  private readonly now: () => number;
  private readonly newSeed: () => number;
  private readonly idleTtlMs: number;
  private readonly maxRoomsPerIp: number;
  private readonly store: RoomStore | undefined;
  readonly games: GameRegistry;
  /** Rooms changed since the last write; saved together on the next tick. */
  private readonly dirty = new Set<string>();
  private flushQueued = false;
  private closed = false;
  /** Called when a scheduled move changed a game (the server sends fresh views). */
  onScheduled: (room: Room) => void = () => {};

  constructor(options: RoomOptions = {}) {
    this.now = options.now ?? Date.now;
    this.newSeed = options.seed ?? (() => randomInt(2 ** 31));
    this.idleTtlMs = options.idleTtlMs ?? DEFAULT_IDLE_TTL_MS;
    this.maxRoomsPerIp = options.maxRoomsPerIp ?? DEFAULT_MAX_ROOMS_PER_IP;
    this.games = createRegistry(options.settings);
    this.store = options.store;
    // Saved rooms come back with every player offline (they rejoin with their token). The
    // server may have been stopped for days, so idle rooms are swept straight away. A room
    // whose game is no longer hosted is dropped.
    for (const stored of this.store?.loadAll() ?? []) {
      if (this.games.has(stored.gameId)) this.rooms.set(stored.code, fromStored(stored));
      else this.store?.delete(stored.code);
    }
    this.sweep();
  }

  /** The registry entry of the room's game. */
  entry(room: Room): GameEntry {
    const entry = this.games.get(room.gameId);
    if (!entry) throw new Error(`room ${room.code} plays unknown game ${room.gameId}`);
    return entry;
  }

  private seats(room: Room): readonly SeatId[] {
    return this.entry(room).definition.meta.seats;
  }

  /** Every room, e.g. to re-arm their timers after a restart. */
  all(): Room[] {
    return [...this.rooms.values()];
  }

  /**
   * Saves the room after it changed. The write happens on the next tick, after the reply
   * and the broadcast, and several changes in a row are saved once.
   */
  save(room: Room): void {
    if (!this.store || this.closed) return;
    this.dirty.add(room.code);
    if (this.flushQueued) return;
    this.flushQueued = true;
    setImmediate(() => this.flush());
  }

  /** Writes every pending change now (also on shutdown). */
  flush(): void {
    this.flushQueued = false;
    if (!this.store || this.closed) return;
    for (const code of this.dirty) {
      const room = this.rooms.get(code);
      if (room) this.store.save(toStored(room));
    }
    this.dirty.clear();
  }

  /**
   * Shutdown: writes what is pending, stops the rooms' timers (the times are in the saved
   * games, and the next start re-arms them) and closes the store. Safe to call twice.
   */
  close(): void {
    if (this.closed) return;
    this.flush();
    this.closed = true;
    for (const room of this.rooms.values()) clearTimeout(room.timer);
    this.store?.close();
  }

  /** A room is gone for good: stop its timer and remove it from the store too. */
  private forget(room: Room): void {
    clearTimeout(room.timer);
    room.timer = undefined;
    this.rooms.delete(room.code);
    this.dirty.delete(room.code);
    this.store?.delete(room.code);
  }

  get size(): number {
    return this.rooms.size;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  bySocket(socketId: string): Seated | undefined {
    const entry = this.sockets.get(socketId);
    const room = entry && this.rooms.get(entry.code);
    const player = room?.players[entry!.seat];
    return room && player ? { room, player } : undefined;
  }

  /**
   * The creator takes the game's first seat. `request.config` holds the lobby's choices,
   * checked by the game; the server's settings for the game are added on top.
   */
  create(
    name: string,
    socketId: string,
    ip = 'unknown',
    request: { game?: string; config?: unknown } = {},
  ): Result<Seated> {
    if (this.sockets.has(socketId)) return err('already-in-room');
    const gameId = request.game ?? DEFAULT_GAME;
    const entry = this.games.get(gameId);
    if (!entry) return err('unknown-game');
    const config = configFor(entry, request.config);
    if (!config) return err('bad-request');
    const fromIp = [...this.rooms.values()].filter((r) => r.creatorIp === ip).length;
    if (fromIp >= this.maxRoomsPerIp) return err('too-many-rooms');
    const code = this.newCode();
    const seat = entry.definition.meta.seats[0]!;
    const room: Room = {
      code,
      gameId,
      players: {},
      config,
      match: { id: matchId(code, 1), number: 1, version: 0 },
      game: entry.definition.setup({ config, seats: [seat], host: seat, seed: this.newSeed() }),
      creatorIp: ip,
      createdAt: this.now(),
      lastActivity: this.now(),
    };
    this.rooms.set(code, room);
    const player = this.seat(room, seat, name, socketId);
    player.creator = true;
    return ok({ room, player });
  }

  join(code: string, name: string, socketId: string): Result<Seated> {
    if (this.sockets.has(socketId)) return err('already-in-room');
    const room = this.rooms.get(code);
    if (!room) return err('room-not-found');
    const free = this.seats(room).find((seat) => !room.players[seat]);
    if (!free) return err('room-full');
    const player = this.seat(room, free, name, socketId);
    this.tell(room, { type: 'table:join', seat: free });
    return ok({ room, player });
  }

  /** Puts a returning player back in their seat on a new socket. */
  rejoin(code: string, token: string, socketId: string): Result<Seated> {
    const room = this.rooms.get(code);
    if (!room) return err('room-not-found');
    const player = this.seats(room)
      .map((seat) => room.players[seat])
      .find((p) => p?.token === token);
    if (!player) return err('bad-token');
    const current = this.sockets.get(socketId);
    if (current && (current.code !== code || current.seat !== player.seat)) {
      return err('already-in-room');
    }
    if (player.socketId) this.sockets.delete(player.socketId);
    player.socketId = socketId;
    this.sockets.set(socketId, { code, seat: player.seat });
    this.touch(room);
    return ok({ room, player });
  }

  /** Marks the player offline; the seat stays reserved for `rejoin`. */
  disconnect(socketId: string): Seated | undefined {
    const seated = this.bySocket(socketId);
    this.sockets.delete(socketId);
    if (seated) seated.player.socketId = null;
    return seated;
  }

  /**
   * The player gives up their seat for good. An empty room is deleted; otherwise a new match
   * starts, so whoever takes the free seat starts fresh with the one who stayed.
   */
  leave(socketId: string): (Seated & { closed: boolean }) | undefined {
    const seated = this.bySocket(socketId);
    if (!seated) return undefined;
    const { room, player } = seated;
    this.sockets.delete(socketId);
    delete room.players[player.seat];
    const stayed = this.seats(room)
      .map((seat) => room.players[seat])
      .filter((p) => p !== undefined);
    if (stayed.length === 0) {
      this.forget(room);
      return { room, player, closed: true };
    }
    // The one who stays now runs the setup.
    if (!stayed.some((p) => p.creator)) stayed[0]!.creator = true;
    this.rematch(room);
    return { room, player, closed: false };
  }

  /** Deletes rooms that nobody is connected to and that have been idle too long. */
  sweep(): string[] {
    const cutoff = this.now() - this.idleTtlMs;
    const removed: string[] = [];
    for (const room of this.rooms.values()) {
      const anyoneOnline = this.seats(room).some((seat) => room.players[seat]?.socketId);
      if (!anyoneOnline && room.lastActivity <= cutoff) {
        this.forget(room);
        removed.push(room.code);
      }
    }
    return removed;
  }

  presence(room: Room): Record<SeatId, SeatInfo | null> {
    const info = (seat: SeatId): SeatInfo | null => {
      const p = room.players[seat];
      return p ? { name: p.name, online: p.socketId !== null, creator: p.creator } : null;
    };
    return Object.fromEntries(this.seats(room).map((seat) => [seat, info(seat)]));
  }

  /**
   * A new match in the same room and seats: from the room's setup, or `config` when given (it
   * then becomes the room's setup). The game may carry choices over from the previous match.
   */
  rematch(room: Room, config: GameConfig = room.config): void {
    const { definition } = this.entry(room);
    const seats = this.seats(room).filter((seat) => room.players[seat]);
    const host = seats.find((seat) => room.players[seat]!.creator) ?? seats[0]!;
    room.config = config;
    room.game = definition.setup({
      config,
      seats,
      host,
      seed: this.newSeed(),
      previous: room.game,
    });
    const number = room.match.number + 1;
    room.match = { id: matchId(room.code, number), number, version: 0 };
    for (const seat of seats) room.players[seat]!.seq = 0;
    this.touch(room);
  }

  /**
   * A player's "play again" while looking at match `seenMatch`, with optional changes to the
   * setup. Before play begins it only changes the setup (or nothing, if it is the same); after
   * that, the match must be over. A second request for a match the partner already replaced
   * changes nothing, unless it asks for another setup and the new match has not started.
   */
  requestRematch(room: Room, seenMatch: string, request?: unknown): Result<void> {
    const entry = this.entry(room);
    const config = request === undefined ? room.config : configFor(entry, request, room.config);
    if (!config) return err('bad-request');
    const { definition } = entry;
    const started = definition.started?.(room.game) ?? true;
    const same = JSON.stringify(config) === JSON.stringify(room.config);
    if (seenMatch === room.match.id) {
      if (started && definition.outcome(room.game) === null) return err('game-not-over');
      if (!started && same) return ok(undefined);
      this.rematch(room, config);
      return ok(undefined);
    }
    if (seenMatch === matchId(room.code, room.match.number - 1)) {
      if (!started && !same) this.rematch(room, config);
      return ok(undefined);
    }
    return err('stale-match');
  }

  /**
   * A player's move from `match:move`: a `seq` already accepted is a harmless repeat (a
   * resend after a reconnect); otherwise the game checks and applies it.
   */
  play(room: Room, player: Player, seq: number, move: GameMove): Result<void, string> {
    if (seq <= player.seq) return ok(undefined);
    const result = this.move(room, player.seat, move);
    if (result.ok) player.seq = seq;
    return result;
  }

  /**
   * A move, checked and applied by the game at the current time. Call `runDue` first, so a
   * move that arrives after the deadline finds the round already over.
   */
  move(room: Room, by: Mover, move: GameMove): Result<void, string> {
    const { definition } = this.entry(room);
    const ctx = { by, at: this.now() };
    const check = definition.validate(room.game, move, ctx);
    if (!check.ok) return err(check.reason);
    room.game = definition.apply(room.game, move, ctx);
    room.match.version++;
    this.touch(room);
    return ok(undefined);
  }

  /** Makes the game's scheduled moves that are due now. Returns the moves made. */
  runDue(room: Room): PlayedMove<GameMove>[] {
    const due = runDue(this.entry(room).definition, room.game, this.now());
    room.game = due.state;
    room.match.version += due.moves.length;
    return due.moves;
  }

  /**
   * Replaces the game state from outside the rules (the E2E test route only): the version
   * moves on, so clients take the new view.
   */
  replaceGame(room: Room, game: GameState): void {
    room.game = game;
    room.match.version++;
    this.touch(room);
  }

  /**
   * Arms one timer for the game's next scheduled move (a timed round running out, an
   * automatic roll), replacing any earlier one. When it fires, the due moves are made and
   * `onScheduled` hears about it. Call after anything that changes a game.
   */
  arm(room: Room): void {
    clearTimeout(room.timer);
    room.timer = undefined;
    if (this.closed || this.rooms.get(room.code) !== room) return;
    const at = nextDue(this.entry(room).definition, room.game);
    if (at === null) return;
    room.timer = setTimeout(
      () => {
        room.timer = undefined;
        if (this.closed || this.rooms.get(room.code) !== room) return; // closed meanwhile
        if (this.runDue(room).length > 0) this.onScheduled(room);
        else this.arm(room); // woke a moment early: wait again
      },
      Math.max(0, at - this.now()),
    );
    room.timer.unref?.();
  }

  /** Before the game starts: the creator takes `seat`; whoever sat there takes theirs. */
  chooseSeat(room: Room, player: Player, seat: SeatId): Result<void, string> {
    if (!player.creator) return err('not-creator');
    if (!this.seats(room).includes(seat)) return err('bad-request');
    const move: TableMove = { type: 'table:choose-seat', seat };
    const check = this.entry(room).definition.validate(room.game, move, {
      by: 'system',
      at: this.now(),
    });
    if (!check.ok) return err(check.reason);
    if (seat !== player.seat) {
      const partner = room.players[seat];
      delete room.players[player.seat];
      if (partner) this.moveTo(room, partner, player.seat);
      this.moveTo(room, player, seat);
    }
    this.tell(room, move);
    return ok(undefined);
  }

  touch(room: Room): void {
    room.lastActivity = this.now();
  }

  /** Tells the game about its table (a join, a seat choice) as a system move. */
  private tell(room: Room, move: TableMove): void {
    const { definition } = this.entry(room);
    const ctx = { by: 'system', at: this.now() } as const;
    if (definition.validate(room.game, move, ctx).ok) {
      room.game = definition.apply(room.game, move, ctx);
      room.match.version++;
    }
    this.touch(room);
  }

  private moveTo(room: Room, player: Player, seat: SeatId): void {
    player.seat = seat;
    room.players[seat] = player;
    if (player.socketId) this.sockets.set(player.socketId, { code: room.code, seat });
  }

  private seat(room: Room, seat: SeatId, name: string, socketId: string): Player {
    const player: Player = { seat, name, token: randomUUID(), socketId, creator: false, seq: 0 };
    room.players[seat] = player;
    this.sockets.set(socketId, { code: room.code, seat });
    this.touch(room);
    return player;
  }

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
  }
}
