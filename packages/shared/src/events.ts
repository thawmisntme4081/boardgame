// Sky Team on the platform's wire protocol (`@platform/protocol`): the generic events filled in
// with Sky Team's seats, moves, lobby choices and view. A renamed event breaks the build.
import type {
  AckResult as GenericAck,
  ClientEvents,
  JoinResult as GenericJoin,
  MatchView,
  PlatformError,
  Presence as GenericPresence,
  SeatInfo,
  ServerEvents,
} from '@platform/protocol';
import type { SkyTeamLobby, SkyTeamPlayerMove } from './definition';
import type { MoveError, Seat } from './types';
import type { PlayerView } from './views';

/** The game's id in the server's registry. */
export const SKY_TEAM = 'sky-team';

/** Platform errors; a refused move answers with a `MoveError` instead. */
export type ErrorCode = PlatformError;
export type JoinResult = GenericJoin<Seat>;
export type AckResult = GenericAck<MoveError>;
/** Platform facts only: the game's own (picks, ready, confirmed) are in the view's `crew`. */
export type PlayerInfo = SeatInfo;
export type Presence = GenericPresence<Seat>;
/** What the lobby and the "Fly again" dialog may choose: the scenario, and the round timer. */
export type GameSetup = SkyTeamLobby;
/** A move a player sends (the server adds nothing but the time). */
export type PlayerMove = SkyTeamPlayerMove;
export type SkyTeamMatchView = MatchView<PlayerView>;

export type ClientToServer = ClientEvents<Seat, PlayerMove, GameSetup, MoveError>;
export type ServerToClient = ServerEvents<Seat, PlayerView>;
