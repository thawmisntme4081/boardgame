import { randomInt, randomUUID } from 'node:crypto';
import {
  beginGame,
  createGame,
  NEXT_TURN_MS,
  ROUND_TIMER_MS,
  SCENARIOS,
  otherSeat,
  SEATS,
  YUL,
  type AbilityId,
  type ErrorCode,
  type GameSetup,
  type GameState,
  type Presence,
  type Scenario,
  type Seat,
} from '@sky/shared';
import { ROOM_CODE_LENGTH } from './schemas';
import { fromStored, toStored, type RoomStore } from './store';

/** No I or O, so codes can't be misread as 1 or 0. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export interface Player {
  seat: Seat;
  name: string;
  token: string;
  socketId: string | null;
  ready: boolean;
  /** Created the game (or stayed when the creator left): picks a single Special Ability. */
  creator: boolean;
  /** Before round 1: the Special Ability card this player picked. */
  pick: AbilityId | null;
  /** Before round 1: happy with the roles and abilities. */
  confirmed: boolean;
}

export interface Room {
  code: string;
  players: Partial<Record<Seat, Player>>;
  game: GameState;
  /** Counted against the per-IP room limit while the room exists. */
  creatorIp: string;
  createdAt: number;
  lastActivity: number;
  /** The creator turned the round timer on in the lobby. */
  timed: boolean;
  /** Before round 1: the creator has chosen who flies which seat. */
  rolesChosen: boolean;
  /** The pending "time ran out" check of a timed round, or Total Trust's roll (see `syncRoundTimer`). */
  roundTimer?: ReturnType<typeof setTimeout>;
  /** Total Trust: when the server rolls the next round's dice (ms since epoch). */
  autoRollAt?: number;
}

export interface RoomOptions {
  now?: () => number;
  seed?: () => number;
  /** Rooms with nobody connected are removed after this long without activity. */
  idleTtlMs?: number;
  /** Live rooms one IP address may have created at once. */
  maxRoomsPerIp?: number;
  /** Length of a timed round (tests and dev shorten it). */
  roundTimerMs?: number;
  /** Total Trust: the pause before the server rolls (tests shorten it). */
  nextTurnMs?: number;
  /**
   * Where rooms are kept between restarts (SQLite in production). Without one, rooms live
   * in memory only and a restart ends every game.
   */
  store?: RoomStore;
}

/** A checked scenario: `resolveSetup` turns a request into one. */
export interface Setup {
  scenario: Scenario;
}

/** Checks a requested scenario: a known one, YUL by default. */
export function resolveSetup({ scenario: id }: GameSetup): Setup | undefined {
  const scenario = id === undefined ? YUL : SCENARIOS[id];
  return scenario ? { scenario } : undefined;
}

/** The scenario as the catalog lists it (a game's copy may have been changed by its modules). */
const setupOf = (game: GameState): Setup => ({
  scenario: SCENARIOS[game.scenario.id] ?? game.scenario,
});

/** Before round 1: the crew is choosing roles and abilities. */
export const isSetupOpen = (game: GameState): boolean => game.phase === 'setup';

/**
 * The Special Abilities the picks make: with two cards, each player's own; with one, the
 * creator's. Fewer than the scenario allows until everyone has picked.
 */
export function pickedAbilities(room: Room): AbilityId[] {
  const count = room.game.scenario.abilities;
  const players = SEATS.map((seat) => room.players[seat]).filter((p) => p !== undefined);
  const picks = (count === 1 ? players.filter((p) => p.creator) : players)
    .map((p) => p.pick)
    .filter((pick) => pick !== null);
  return [...new Set(picks)].slice(0, count);
}

export const DEFAULT_IDLE_TTL_MS = 30 * 60_000;
export const DEFAULT_MAX_ROOMS_PER_IP = 5;

export interface Seated {
  room: Room;
  player: Player;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: ErrorCode };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const err = <T>(error: ErrorCode): Result<T> => ({ ok: false, error });

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  /** Which room and seat each connected socket occupies. */
  private readonly sockets = new Map<string, { code: string; seat: Seat }>();

  private readonly now: () => number;
  private readonly newSeed: () => number;
  private readonly idleTtlMs: number;
  private readonly maxRoomsPerIp: number;
  private readonly roundTimerMs: number;
  /** Total Trust: how long after the round ends the server rolls the dice. */
  readonly nextTurnMs: number;
  private readonly store: RoomStore | undefined;
  /** Rooms changed since the last write; saved together on the next tick. */
  private readonly dirty = new Set<string>();
  private flushQueued = false;
  private closed = false;

  constructor(options: RoomOptions = {}) {
    this.now = options.now ?? Date.now;
    this.newSeed = options.seed ?? (() => randomInt(2 ** 31));
    this.idleTtlMs = options.idleTtlMs ?? DEFAULT_IDLE_TTL_MS;
    this.maxRoomsPerIp = options.maxRoomsPerIp ?? DEFAULT_MAX_ROOMS_PER_IP;
    this.roundTimerMs = options.roundTimerMs ?? ROUND_TIMER_MS;
    this.nextTurnMs = options.nextTurnMs ?? NEXT_TURN_MS;
    this.store = options.store;
    // Saved rooms come back with every player offline (they rejoin with their token). The
    // server may have been stopped for days, so idle rooms are swept straight away.
    for (const stored of this.store?.loadAll() ?? []) {
      this.rooms.set(stored.code, fromStored(stored));
    }
    this.sweep();
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
   * Shutdown: writes what is pending, stops the rooms' timers (their deadlines are saved
   * and re-armed by the next start) and closes the store. Safe to call twice.
   */
  close(): void {
    if (this.closed) return;
    this.flush();
    this.closed = true;
    for (const room of this.rooms.values()) clearTimeout(room.roundTimer);
    this.store?.close();
  }

  /** A room is gone for good: remove it from the store too. */
  private forget(code: string): void {
    this.rooms.delete(code);
    this.dirty.delete(code);
    this.store?.delete(code);
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

  /** The creator takes the pilot seat and chooses the scenario and whether the game is timed. */
  create(
    name: string,
    socketId: string,
    ip = 'unknown',
    { timer = false, setup = { scenario: YUL } }: { timer?: boolean; setup?: Setup } = {},
  ): Result<Seated> {
    if (this.sockets.has(socketId)) return err('already-in-room');
    const fromIp = [...this.rooms.values()].filter((r) => r.creatorIp === ip).length;
    if (fromIp >= this.maxRoomsPerIp) return err('too-many-rooms');
    const code = this.newCode();
    const room: Room = {
      code,
      players: {},
      game: createGame(setup.scenario, this.newSeed(), {
        timerMs: timer ? this.roundTimerMs : null,
        setup: true,
      }),
      timed: timer,
      rolesChosen: false,
      creatorIp: ip,
      createdAt: this.now(),
      lastActivity: this.now(),
    };
    this.rooms.set(code, room);
    const player = this.seat(room, 'pilot', name, socketId);
    player.creator = true;
    return ok({ room, player });
  }

  join(code: string, name: string, socketId: string): Result<Seated> {
    if (this.sockets.has(socketId)) return err('already-in-room');
    const room = this.rooms.get(code);
    if (!room) return err('room-not-found');
    const free = SEATS.find((seat) => !room.players[seat]);
    if (!free) return err('room-full');
    return ok({ room, player: this.seat(room, free, name, socketId) });
  }

  /** Puts a returning player back in their seat on a new socket. */
  rejoin(code: string, token: string, socketId: string): Result<Seated> {
    const room = this.rooms.get(code);
    if (!room) return err('room-not-found');
    const player = SEATS.map((seat) => room.players[seat]).find((p) => p?.token === token);
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
   * The player gives up their seat for good. An empty room is deleted; otherwise the
   * game restarts, so whoever takes the free seat starts fresh with the one who stayed.
   */
  leave(socketId: string): (Seated & { closed: boolean }) | undefined {
    const seated = this.bySocket(socketId);
    if (!seated) return undefined;
    const { room, player } = seated;
    this.sockets.delete(socketId);
    delete room.players[player.seat];
    if (SEATS.every((seat) => !room.players[seat])) {
      this.forget(room.code);
      return { room, player, closed: true };
    }
    // The one who stays now runs the setup, and roles are chosen again with the newcomer.
    const stayed = room.players[otherSeat(player.seat)];
    if (stayed) stayed.creator = true;
    room.rolesChosen = false;
    this.rematch(room);
    return { room, player, closed: false };
  }

  /** Deletes rooms that nobody is connected to and that have been idle too long. */
  sweep(): string[] {
    const cutoff = this.now() - this.idleTtlMs;
    const removed: string[] = [];
    for (const room of this.rooms.values()) {
      const anyoneOnline = SEATS.some((seat) => room.players[seat]?.socketId);
      if (!anyoneOnline && room.lastActivity <= cutoff) {
        this.forget(room.code);
        removed.push(room.code);
      }
    }
    return removed;
  }

  presence(room: Room): Presence {
    const info = (seat: Seat) => {
      const p = room.players[seat];
      return p
        ? {
            name: p.name,
            online: p.socketId !== null,
            ready: p.ready,
            creator: p.creator,
            pick: p.pick,
            rolesChosen: room.rolesChosen,
            confirmed: p.confirmed,
          }
        : null;
    };
    return { pilot: info('pilot'), copilot: info('copilot') };
  }

  bothSeated(room: Room): boolean {
    return SEATS.every((seat) => room.players[seat]);
  }

  /** Same room and seats, fresh game: the same scenario unless `setup` picks another. */
  rematch(room: Room, setup: Setup = setupOf(room.game)): void {
    // A rematch (or a restart after someone leaves) keeps the timed/untimed choice; a
    // Real-time scenario sets its own timer, so the room remembers the lobby choice.
    room.game = createGame(setup.scenario, this.newSeed(), {
      timerMs: room.timed ? this.roundTimerMs : null,
      setup: true,
    });
    // The last picks are the starting point for the new game's choice.
    this.syncAbilities(room);
    this.touch(room);
  }

  /** Copies the picks into the game, and cancels any confirm given for the old choice. */
  private syncAbilities(room: Room): void {
    room.game = { ...room.game, abilities: pickedAbilities(room) };
    for (const seat of SEATS) {
      const player = room.players[seat];
      if (player) {
        player.ready = false;
        player.confirmed = false;
      }
    }
  }

  /** Before round 1: pick (or, with `null`, take back) your Special Ability card. */
  pickAbility(room: Room, player: Player, ability: AbilityId | null): Result<void> {
    if (!isSetupOpen(room.game)) return err('setup-closed');
    const count = room.game.scenario.abilities;
    if (count === 0 || (count === 1 && !player.creator)) return err('not-your-pick');
    const partner = room.players[otherSeat(player.seat)];
    if (ability !== null && count === 2 && partner?.pick === ability) return err('ability-taken');
    player.pick = ability;
    this.syncAbilities(room);
    this.touch(room);
    return ok(undefined);
  }

  /** Before round 1, rolling needs every Special Ability card chosen. */
  abilitiesChosen(room: Room): boolean {
    return room.game.abilities.length === room.game.scenario.abilities;
  }

  /** Before round 1: the creator takes `seat`; the partner (now or later) gets the other one. */
  chooseSeat(room: Room, player: Player, seat: Seat): Result<void> {
    if (!isSetupOpen(room.game)) return err('setup-closed');
    if (!player.creator) return err('not-creator');
    if (seat !== player.seat) {
      const partner = room.players[seat];
      delete room.players[player.seat];
      if (partner) {
        partner.seat = player.seat;
        room.players[partner.seat] = partner;
        if (partner.socketId)
          this.sockets.set(partner.socketId, { code: room.code, seat: partner.seat });
      }
      player.seat = seat;
      room.players[seat] = player;
      if (player.socketId) this.sockets.set(player.socketId, { code: room.code, seat });
    }
    room.rolesChosen = true;
    this.syncAbilities(room);
    this.touch(room);
    return ok(undefined);
  }

  /**
   * Before round 1: this player is happy with the roles and abilities. Once both have
   * confirmed, round 1 starts: the traffic die rolls and the strategy discussion begins.
   */
  confirm(room: Room, player: Player): Result<void> {
    if (!isSetupOpen(room.game)) return err('setup-closed');
    if (!this.bothSeated(room)) return err('no-partner');
    if (!room.rolesChosen) return err('roles-missing');
    if (!this.abilitiesChosen(room)) return err('abilities-missing');
    player.confirmed = true;
    if (SEATS.every((seat) => room.players[seat]?.confirmed)) {
      room.game = beginGame(room.game);
      for (const seat of SEATS) room.players[seat]!.confirmed = false;
    }
    this.touch(room);
    return ok(undefined);
  }

  touch(room: Room): void {
    room.lastActivity = this.now();
  }

  private seat(room: Room, seat: Seat, name: string, socketId: string): Player {
    const player: Player = {
      seat,
      name,
      token: randomUUID(),
      socketId,
      ready: false,
      creator: false,
      pick: null,
      confirmed: false,
    };
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
