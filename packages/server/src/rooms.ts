import { randomInt, randomUUID } from 'node:crypto';
import {
  createGame,
  SEATS,
  YUL,
  type ErrorCode,
  type GameState,
  type Presence,
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
  createdAt: number;
  lastActivity: number;
}

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

  constructor(private readonly now: () => number = Date.now) {}

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

  /** The creator takes the pilot seat. */
  create(name: string, socketId: string, seed = randomInt(2 ** 31)): Result<Seated> {
    if (this.sockets.has(socketId)) return err('already-in-room');
    const code = this.newCode();
    const room: Room = {
      code,
      players: {},
      game: createGame(YUL, seed),
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
