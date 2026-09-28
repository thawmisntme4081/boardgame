// Socket.IO protocol shared by server and client: a renamed event breaks the build.
import type { Seat } from './types';
import type { PlayerView } from './views';

export type ErrorCode =
  | 'bad-request'
  | 'room-not-found'
  | 'room-full'
  | 'bad-token'
  | 'not-in-room'
  | 'already-in-room'
  | 'not-strategy';

export type JoinResult =
  { ok: true; code: string; seat: Seat; token: string } | { ok: false; error: ErrorCode };

export type AckResult = { ok: true } | { ok: false; error: ErrorCode };

export interface PlayerInfo {
  name: string;
  online: boolean;
  /** Ready to roll: the strategy discussion is over for this player. */
  ready: boolean;
}

/** Who sits in each seat; `null` while the seat is empty. */
export type Presence = Record<Seat, PlayerInfo | null>;

export interface CreateRoomPayload {
  name: string;
}
export interface JoinRoomPayload {
  code: string;
  name: string;
}
export interface RejoinRoomPayload {
  code: string;
  token: string;
}

export interface ClientToServer {
  'room:create': (payload: CreateRoomPayload, ack: (result: JoinResult) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (result: JoinResult) => void) => void;
  'room:rejoin': (payload: RejoinRoomPayload, ack: (result: JoinResult) => void) => void;
  'game:ready': (payload: Record<string, never>, ack: (result: AckResult) => void) => void;
}

export interface ServerToClient {
  'game:view': (view: PlayerView) => void;
  'room:presence': (presence: Presence) => void;
}
