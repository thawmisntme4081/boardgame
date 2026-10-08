import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import {
  nextDue,
  replay,
  runDue,
  type GameDefinition,
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
import {
  fromStored,
  hashToken,
  toStored,
  type LoadedMatch,
  type EndedStatus,
  type MatchStore,
  type StoredRoom,
} from './store';

/** No I or O, so codes can't be misread as 1 or 0. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** The game a room plays when `room:create` names none (the only one so far). */
export const DEFAULT_GAME = 'sky-team';

/** A snapshot of the state goes into the match log every this many changes (and at the end). */
export const SNAPSHOT_EVERY = 50;

export interface Player {
  seat: SeatId;
  name: string;
  /** The rejoin token, hashed: the player holds the token itself. */
  tokenHash: string;
  socketId: string | null;
  /** Created the room (or stayed when the creator left): runs the setup. */
  creator: boolean;
  /** The last `match:move` counter accepted from this player in the current match. */
  seq: number;
  /**
   * The signed-in player's account (Platform 06): the seat follows it to another device
   * (`resume`). Guests have none and rejoin with their token only.
   */
  userId?: string;
}

/** The game being played in a room. A rematch starts a new match in the same room. */
export interface Match {
  /** Unique for good (room codes come back once a room is gone): `<code>-<number>-<random>`. */
  id: string;
  number: number;
  /** Accepted changes so far: views carry it, and it numbers the moves in the match log. */
  version: number;
  /** The match this one replaced in the room: a late "play again" for it changes nothing. */
  previousId?: string;
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
   * Where rooms and their match logs are kept between restarts (SQLite in production).
   * Without one, rooms live in memory only and a restart ends every game.
   */
  store?: MatchStore;
}

export const DEFAULT_IDLE_TTL_MS = 30 * 60_000;
export const DEFAULT_MAX_ROOMS_PER_IP = 5;

export interface Seated {
  room: Room;
  player: Player;
  /** The player's rejoin token: only on the create or join that made it (and on a rejoin). */
  token?: string;
  /** The connection this seat had before it moved to this one (`claim`), if any. */
  replaced?: string;
}

/** A refusal: a platform code, or the game's own reason for refusing a move. */
export type Result<T, E = PlatformError> = { ok: true; value: T } | { ok: false; error: E };

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const newMatchId = (code: string, number: number) =>
  `${code}-${number}-${randomBytes(4).toString('hex')}`;

/**
 * A match from its log: the latest snapshot, then the moves made after it. A match saved by
 * an older rules version goes through the game's `migrate` first; without one it cannot be
 * loaded (`undefined`).
 */
export function restoreMatch<S, M, V, C>(
  definition: GameDefinition<S, M, V, C>,
  loaded: LoadedMatch,
): { state: S; version: number } | undefined {
  const { match, snapshot, moves } = loaded;
  let state: S;
  if (match.rulesVersion === definition.version) state = snapshot.state as S;
  else if (definition.migrate) state = definition.migrate(snapshot.state, match.rulesVersion);
  else return undefined;
  const played = moves.map(({ move, by, at }) => ({ move: move as M, by, at }));
  return { state: replay(definition, state, played), version: moves.at(-1)?.n ?? snapshot.n };
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  /** Which room and seat each connected socket occupies. */
  private readonly sockets = new Map<string, { code: string; seat: SeatId }>();

  private readonly now: () => number;
  private readonly newSeed: () => number;
  private readonly idleTtlMs: number;
  private readonly maxRoomsPerIp: number;
  private readonly store: MatchStore | undefined;
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
    this.load();
    this.sweep();
  }

  /**
   * Saved rooms come back with every player offline (they rejoin with their token), each
   * with its match rebuilt from the log. The server may have been stopped for days, so idle
   * rooms are swept straight after. A room whose game is no longer hosted, or whose match
   * cannot be loaded, is dropped; so is an open match no room points to any more.
   */
  private load(): void {
    const { store } = this;
    if (!store) return;
    for (const stored of store.loadRooms()) {
      const room = this.restore(stored);
      if (room) this.rooms.set(room.code, room);
      else {
        store.deleteRoom(stored.code);
        store.endMatch(stored.match.id, 'abandoned', null, this.now());
      }
    }
    const current = new Set([...this.rooms.values()].map((r) => r.match.id));
    for (const match of store.listOpen()) {
      if (!current.has(match.id)) store.endMatch(match.id, 'abandoned', null, this.now());
    }
  }

  private restore(stored: StoredRoom): Room | undefined {
    const entry = this.games.get(stored.gameId);
    const loaded = entry && this.store?.loadMatch(stored.match.id);
    const restored = entry && loaded && restoreMatch(entry.definition, loaded);
    if (!entry || !loaded || !restored) return undefined;
    const room = fromStored(stored, restored.state);
    room.match.version = restored.version;
    // A match that ended just before the server stopped is closed in the log too.
    const outcome = entry.definition.outcome(room.game);
    if (outcome && loaded.match.status === 'open') this.endInLog(room);
    return room;
  }

  /** An account's Flight Log for a game: its records, newest first. */
  flightLog(userId: string, gameId: string): unknown[] {
    return this.store?.flightLog(userId, gameId).map((e) => e.record) ?? [];
  }

  /**
   * Adds games a device kept before sign-in to the account's Flight Log. Invalid records are
   * skipped; one already there (same game, scenario, seat and end time) is not added twice.
   * Returns how many records were valid, or `undefined` if the game cannot import.
   */
  importFlightLog(userId: string, gameId: string, raw: unknown[]): number | undefined {
    const entry = this.games.get(gameId);
    if (!this.store || !entry?.importRecord) return undefined;
    const entries = raw.flatMap((item) => {
      const parsed = entry.importRecord!(item);
      if (!parsed) return [];
      const { seat, scenario } = parsed.record as { seat: string; scenario: string };
      return [
        {
          userId,
          matchId: `import:${gameId}:${scenario}:${seat}:${parsed.at}`,
          gameId,
          endedAt: parsed.at,
          record: parsed.record,
        },
      ];
    });
    this.store.addFlightEntries(entries);
    return entries.length;
  }

  /**
   * An account was deleted: its seats stay in their rooms as guests' (nothing links them to
   * the account any more), and its Flight Log and match seats are cleared in the store.
   */
  forgetAccount(userId: string): void {
    for (const room of this.rooms.values()) {
      let changed = false;
      for (const player of this.players(room)) {
        if (player.userId !== userId) continue;
        delete player.userId;
        changed = true;
      }
      if (changed) this.save(room);
    }
    this.store?.deleteUserData(userId);
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
   * Saves the room (players, the current match) after it changed. The write happens on the
   * next tick, after the reply and the broadcast, and several changes in a row are saved once.
   * The match log itself is written as each change happens.
   */
  save(room: Room): void {
    if (!this.store || this.closed) return;
    this.dirty.add(room.code);
    if (this.flushQueued) return;
    this.flushQueued = true;
    setImmediate(() => this.flush());
  }

  /** Writes every pending room change now (also on shutdown). */
  flush(): void {
    this.flushQueued = false;
    if (!this.store || this.closed) return;
    for (const code of this.dirty) {
      const room = this.rooms.get(code);
      if (room) this.store.saveRoom(toStored(room));
    }
    this.dirty.clear();
  }

  /**
   * Shutdown: snapshots every open match (so the next start, perhaps on newer rules, loads
   * from the state itself), writes what is pending, stops the timers (the times are in the
   * saved games, and the next start re-arms them) and closes the store. Safe to call twice.
   */
  close(): void {
    if (this.closed) return;
    for (const room of this.rooms.values()) {
      if (this.entry(room).definition.outcome(room.game) === null) this.snapshot(room);
    }
    this.flush();
    this.closed = true;
    for (const room of this.rooms.values()) clearTimeout(room.timer);
    this.store?.close();
  }

  /** A room is gone for good: stop its timer, remove it from the store, close its match. */
  private forget(room: Room): void {
    clearTimeout(room.timer);
    room.timer = undefined;
    this.rooms.delete(room.code);
    this.dirty.delete(room.code);
    this.store?.deleteRoom(room.code);
    this.abandonIfOpen(room);
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
    request: { game?: string; config?: unknown; userId?: string } = {},
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
    const seed = this.newSeed();
    const room: Room = {
      code,
      gameId,
      players: {},
      config,
      match: { id: newMatchId(code, 1), number: 1, version: 0 },
      game: entry.definition.setup({ config, seats: [seat], host: seat, seed }),
      creatorIp: ip,
      createdAt: this.now(),
      lastActivity: this.now(),
    };
    this.rooms.set(code, room);
    const { player, token } = this.seat(room, seat, name, socketId, request.userId);
    player.creator = true;
    this.startInLog(room, seed);
    return ok({ room, player, token });
  }

  /**
   * Takes a free seat. A signed-in player who already holds a seat here gets it back instead
   * (one account never holds two seats of a room).
   */
  join(code: string, name: string, socketId: string, userId?: string): Result<Seated> {
    if (this.sockets.has(socketId)) return err('already-in-room');
    const room = this.rooms.get(code);
    if (!room) return err('room-not-found');
    const own = userId && this.players(room).find((p) => p.userId === userId);
    if (own) return ok(this.claim(room, own, socketId));
    const free = this.seats(room).find((seat) => !room.players[seat]);
    if (!free) return err('room-full');
    const { player, token } = this.seat(room, free, name, socketId, userId);
    this.tell(room, { type: 'table:join', seat: free });
    this.seatsInLog(room);
    return ok({ room, player, token });
  }

  /**
   * Puts a returning player back in their seat on a new socket. Signed in now, a guest's seat
   * becomes the account's (unless the account already holds the other seat).
   */
  rejoin(code: string, token: string, socketId: string, userId?: string): Result<Seated> {
    const room = this.rooms.get(code);
    if (!room) return err('room-not-found');
    const tokenHash = hashToken(token);
    const player = this.seats(room)
      .map((seat) => room.players[seat])
      .find((p) => p?.tokenHash === tokenHash);
    if (!player) return err('bad-token');
    const current = this.sockets.get(socketId);
    if (current && (current.code !== code || current.seat !== player.seat)) {
      return err('already-in-room');
    }
    if (player.socketId) this.sockets.delete(player.socketId);
    player.socketId = socketId;
    this.sockets.set(socketId, { code, seat: player.seat });
    if (userId && !player.userId && !this.players(room).some((p) => p.userId === userId)) {
      player.userId = userId;
      this.seatsInLog(room);
    }
    this.touch(room);
    return ok({ room, player, token });
  }

  /**
   * A signed-in player on any device: back to the seat their account holds, in the most
   * recently active room. The seat gets a new token (the old one stops working; a device
   * still holding it is signed in too, so it resumes the same way).
   */
  resume(userId: string, socketId: string): Result<Seated> {
    const held = [...this.rooms.values()]
      .flatMap((room) => this.players(room).map((player) => ({ room, player })))
      .filter(({ player }) => player.userId === userId)
      .sort((a, b) => b.room.lastActivity - a.room.lastActivity)[0];
    if (!held) return err('not-in-room');
    const current = this.sockets.get(socketId);
    if (current && (current.code !== held.room.code || current.seat !== held.player.seat)) {
      return err('already-in-room');
    }
    return ok(this.claim(held.room, held.player, socketId));
  }

  /** Who sits in a room, seat by seat. */
  private players(room: Room): Player[] {
    return this.seats(room)
      .map((seat) => room.players[seat])
      .filter((p) => p !== undefined);
  }

  /** Moves a seat to a new socket with a new rejoin token (`join` by account, `resume`). */
  private claim(room: Room, player: Player, socketId: string): Seated {
    const token = randomUUID();
    const replaced = player.socketId ?? undefined;
    player.tokenHash = hashToken(token);
    if (replaced) this.sockets.delete(replaced);
    player.socketId = socketId;
    this.sockets.set(socketId, { code: room.code, seat: player.seat });
    this.seatsInLog(room);
    this.touch(room);
    return { room, player, token, ...(replaced && replaced !== socketId && { replaced }) };
  }

  /** The seat that holds `token` in room `code`, if any (to find its old connection). */
  seatOf(code: string, token: string): Player | undefined {
    const room = this.rooms.get(code);
    const tokenHash = hashToken(token);
    return room && Object.values(room.players).find((p) => p?.tokenHash === tokenHash);
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

  /**
   * Deletes rooms that nobody is connected to and that have been idle too long, and the ended
   * matches each game no longer keeps (its `keepEnded`).
   */
  sweep(): string[] {
    for (const [gameId, { keepEnded = {} }] of this.games) {
      for (const [status, ms] of Object.entries(keepEnded) as [EndedStatus, number][]) {
        if (!this.closed) this.store?.pruneEnded(gameId, status, this.now() - ms);
      }
    }
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
    this.abandonIfOpen(room);
    const seats = this.seats(room).filter((seat) => room.players[seat]);
    const host = seats.find((seat) => room.players[seat]!.creator) ?? seats[0]!;
    const seed = this.newSeed();
    room.config = config;
    room.game = definition.setup({ config, seats, host, seed, previous: room.game });
    const number = room.match.number + 1;
    room.match = {
      id: newMatchId(room.code, number),
      number,
      version: 0,
      previousId: room.match.id,
    };
    for (const seat of seats) room.players[seat]!.seq = 0;
    this.startInLog(room, seed);
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
    if (seenMatch === room.match.previousId) {
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
   * A move, checked and applied by the game at the current time, and written to the match
   * log. Call `runDue` first, so a move that arrives after the deadline finds the round over.
   */
  move(room: Room, by: Mover, move: GameMove): Result<void, string> {
    const { definition } = this.entry(room);
    const ctx = { by, at: this.now() };
    const check = definition.validate(room.game, move, ctx);
    if (!check.ok) return err(check.reason);
    this.accept(room, { move, ...ctx });
    this.touch(room);
    return ok(undefined);
  }

  /** Makes the game's scheduled moves that are due now. Returns the moves made. */
  runDue(room: Room): PlayedMove<GameMove>[] {
    const { definition } = this.entry(room);
    const due = runDue(definition, room.game, this.now());
    // Applied again one by one, so each lands in the log with its own number.
    for (const played of due.moves) this.accept(room, played);
    return due.moves;
  }

  /**
   * Replaces the game state from outside the rules (the E2E test route only): the version
   * moves on, clients take the new view, and the log gets a snapshot (no move made it).
   */
  replaceGame(room: Room, game: GameState): void {
    room.game = game;
    room.match.version++;
    this.snapshot(room);
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
    this.seatsInLog(room);
    return ok(undefined);
  }

  touch(room: Room): void {
    room.lastActivity = this.now();
  }

  /** Tells the game about its table (a join, a seat choice) as a system move. */
  private tell(room: Room, move: TableMove): void {
    const { definition } = this.entry(room);
    const ctx = { by: 'system', at: this.now() } as const;
    if (definition.validate(room.game, move, ctx).ok) this.accept(room, { move, ...ctx });
    this.touch(room);
  }

  /**
   * Applies an accepted move: the state and version move on, the move goes into the match log
   * (before anyone sees it), with a snapshot now and then and when the game ends.
   */
  private accept(room: Room, played: PlayedMove<GameMove>): void {
    const { definition } = this.entry(room);
    const wasOver = definition.outcome(room.game) !== null;
    room.game = definition.apply(room.game, played.move, played);
    const n = ++room.match.version;
    this.store?.appendMove(room.match.id, { n, move: played.move, by: played.by, at: played.at });
    if (!wasOver && definition.outcome(room.game) !== null) this.endInLog(room);
    else if (n % SNAPSHOT_EVERY === 0) this.snapshot(room);
  }

  private snapshot(room: Room): void {
    this.store?.saveSnapshot(room.match.id, { n: room.match.version, state: room.game });
  }

  /** A new match in the log: its record, the state after setup, and the seats. */
  private startInLog(room: Room, seed: number): void {
    if (!this.store) return;
    const { definition } = this.entry(room);
    this.store.createMatch(
      {
        id: room.match.id,
        roomCode: room.code,
        gameId: room.gameId,
        rulesVersion: definition.version,
        config: room.config,
        seed,
        status: 'open',
        createdAt: this.now(),
        endedAt: null,
        outcome: null,
      },
      { n: room.match.version, state: room.game },
    );
    this.seatsInLog(room);
  }

  private seatsInLog(room: Room): void {
    const seats = Object.values(room.players)
      .filter((p) => p !== undefined)
      .map(({ seat, name, tokenHash, userId }) => ({
        seat,
        name,
        tokenHash,
        userId: userId ?? null,
      }));
    this.store?.saveSeats(room.match.id, seats);
  }

  /** The game ended: its final state and outcome go into the log. */
  private endInLog(room: Room): void {
    const outcome = this.entry(room).definition.outcome(room.game);
    this.snapshot(room);
    const at = this.now();
    this.store?.endMatch(room.match.id, 'over', outcome, at);
    this.flightLogFor(room, at);
  }

  /**
   * Each signed-in player's Flight Log entry for the match that just ended. The log keeps the
   * first entry per account and match, so a room restored after a restart writes nothing twice.
   */
  private flightLogFor(room: Room, at: number): void {
    const { definition, flightRecord } = this.entry(room);
    if (!this.store || !flightRecord) return;
    const players = this.players(room);
    const entries = players.flatMap((player) => {
      if (!player.userId) return [];
      const view = definition.view(room.game, player.seat, at);
      const others = players.filter((p) => p !== player).map((p) => p.name);
      const record = flightRecord(view, others, at);
      return record == null
        ? []
        : [
            {
              userId: player.userId,
              matchId: room.match.id,
              gameId: room.gameId,
              endedAt: at,
              record,
            },
          ];
    });
    this.store.addFlightEntries(entries);
  }

  /** The room moves on (or goes) before its match ended: the match is abandoned. */
  private abandonIfOpen(room: Room): void {
    if (this.entry(room).definition.outcome(room.game) !== null) return;
    this.snapshot(room);
    this.store?.endMatch(room.match.id, 'abandoned', null, this.now());
  }

  private moveTo(room: Room, player: Player, seat: SeatId): void {
    player.seat = seat;
    room.players[seat] = player;
    if (player.socketId) this.sockets.set(player.socketId, { code: room.code, seat });
  }

  private seat(
    room: Room,
    seat: SeatId,
    name: string,
    socketId: string,
    userId?: string,
  ): { player: Player; token: string } {
    const token = randomUUID();
    const player: Player = {
      seat,
      name,
      tokenHash: hashToken(token),
      socketId,
      creator: false,
      seq: 0,
      ...(userId && { userId }),
    };
    room.players[seat] = player;
    this.sockets.set(socketId, { code: room.code, seat });
    this.touch(room);
    return { player, token };
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
