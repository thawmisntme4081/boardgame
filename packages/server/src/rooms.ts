import { randomInt, randomUUID } from 'node:crypto';
import {
  ABILITY_IDS,
  createGame,
  ROUND_TIMER_MS,
  SCENARIOS,
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

/** No I or O, so codes can't be misread as 1 or 0. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export interface Player {
  seat: Seat;
  name: string;
  token: string;
  socketId: string | null;
  ready: boolean;
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
  /** The pending "time ran out" check of a timed round (see `syncRoundTimer`). */
  roundTimer?: ReturnType<typeof setTimeout>;
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
}

/** A scenario and its abilities, checked: `resolveSetup` turns a request into one. */
export interface Setup {
  scenario: Scenario;
  abilities: AbilityId[];
}

/**
 * Checks a requested scenario and Special Abilities: a known scenario (YUL by default) and
 * exactly as many distinct abilities as it allows (the first ones by default).
 */
export function resolveSetup({ scenario: id, abilities }: GameSetup): Setup | undefined {
  const scenario = id === undefined ? YUL : SCENARIOS[id];
  if (!scenario) return undefined;
  const chosen = abilities ?? ABILITY_IDS.slice(0, scenario.abilities);
  if (chosen.length !== scenario.abilities || new Set(chosen).size !== chosen.length) {
    return undefined;
  }
  return { scenario, abilities: [...chosen] };
}

const setupOf = (game: GameState): Setup => ({
  scenario: game.scenario,
  abilities: game.abilities,
});

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

  constructor(options: RoomOptions = {}) {
    this.now = options.now ?? Date.now;
    this.newSeed = options.seed ?? (() => randomInt(2 ** 31));
    this.idleTtlMs = options.idleTtlMs ?? DEFAULT_IDLE_TTL_MS;
    this.maxRoomsPerIp = options.maxRoomsPerIp ?? DEFAULT_MAX_ROOMS_PER_IP;
    this.roundTimerMs = options.roundTimerMs ?? ROUND_TIMER_MS;
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
    {
      timer = false,
      setup = { scenario: YUL, abilities: [] },
    }: { timer?: boolean; setup?: Setup } = {},
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
        abilities: setup.abilities,
      }),
      timed: timer,
      creatorIp: ip,
      createdAt: this.now(),
      lastActivity: this.now(),
    };
    this.rooms.set(code, room);
    return ok({ room, player: this.seat(room, 'pilot', name, socketId) });
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
      this.rooms.delete(room.code);
      return { room, player, closed: true };
    }
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
        this.rooms.delete(room.code);
        removed.push(room.code);
      }
    }
    return removed;
  }

  presence(room: Room): Presence {
    const info = (seat: Seat) => {
      const p = room.players[seat];
      return p ? { name: p.name, online: p.socketId !== null, ready: p.ready } : null;
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
      abilities: setup.abilities,
    });
    for (const seat of SEATS) {
      const player = room.players[seat];
      if (player) player.ready = false;
    }
    this.touch(room);
  }

  touch(room: Room): void {
    room.lastActivity = this.now();
  }

  private seat(room: Room, seat: Seat, name: string, socketId: string): Player {
    const player: Player = { seat, name, token: randomUUID(), socketId, ready: false };
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
