// The client side of the game contract: what a game's UI gives the platform shell, and what the
// shell gives it back. The shell owns the connection, rooms, presence and pages; the game owns
// its board, its lobby options and its texts. A game module is loaded only when it is needed.
import type { ComponentType } from 'react';
import type { Locales } from './i18n';

export type Connection = 'connecting' | 'online' | 'offline';

export interface SeatInfo {
  name: string;
  online: boolean;
  creator: boolean;
}

/**
 * Who sits where (platform facts only), as the server sends it: each seat's info, `null` for an
 * empty seat, and `you`, the seat it was sent to.
 */
export interface SeatPresence {
  [seat: string]: SeatInfo | null | string | undefined;
  you?: string;
}

/** A seat's info from presence (`undefined` for `you`, or a seat the game does not have). */
export function seatInfo(presence: SeatPresence | null, seat: string): SeatInfo | null | undefined {
  const info = presence?.[seat];
  return typeof info === 'string' ? undefined : info;
}

/** What the shell does for a game: every request goes through it (one socket, one protocol). */
export interface PlatformApi<Move, Setup> {
  /** A move in the current match. Shows the error and resolves `false` if it is refused. */
  send(move: Move): Promise<boolean>;
  /** Before the game starts: the creator takes `seat`. */
  chooseSeat(seat: string): Promise<boolean>;
  /** A new match in the same room, with changes to the lobby's choices. */
  rematch(setup?: Setup): Promise<boolean>;
  /** Gives up the seat for good and goes back to the game's page. */
  leave(): Promise<void>;
  /** After a game: "not now" to the partner's rematch offer, or taking back your own. */
  declineRematch(): Promise<boolean>;
  /** Whether the player is signed in to an account (Platform 06). */
  signedIn(): boolean;
  /**
   * The signed-in account's Flight Log for this game, newest first, as the game's own records
   * (the server wrote them when each match ended); `null` when signed out or unreachable.
   */
  flightLog(game: string): Promise<unknown[] | null>;
  /** Adds records kept on this device to the account's log; `true` once the server has them all. */
  importFlightLog(game: string, records: unknown[]): Promise<boolean>;
}

/**
 * A rematch after a game needs every seated player: one makes an offer (`by` is their seat),
 * the others accept by asking for a rematch too, or decline. `config` is the offered setup;
 * `accepted` the seats that asked so far, the offerer first.
 */
export interface RematchState {
  by: string | null;
  config: unknown;
  accepted?: string[];
}

export interface BoardProps<View> {
  view: View;
  presence: SeatPresence | null;
  connection: Connection;
  /** The rematch offer waiting for an answer, if any. */
  rematch: RematchState;
}

export interface SetupFormProps<Setup> {
  value: Setup;
  onChange(setup: Setup): void;
}

export interface GameClientModule<View = unknown, Move = unknown, Setup = unknown> {
  /** The game's id in the server registry, and its i18n namespace. */
  id: string;
  /** Its texts, one object per language. */
  locales: Locales;
  /** The lobby's choices for a new game, and their starting value. */
  defaultSetup: Setup;
  SetupForm: ComponentType<SetupFormProps<Setup>>;
  /** The match: everything below the platform's connection handling. */
  Board: ComponentType<BoardProps<View>>;
  /** The waiting room's heading while a seat is empty (who is missing, the chosen setup). */
  WaitingInfo: ComponentType<{ view: View; presence: SeatPresence | null }>;
  /** Called once, when the module loads: the shell's services. */
  connect(platform: PlatformApi<Move, Setup>): void;
  /** Every new view of the match, before it is shown (`before`: the last one, if any). */
  onView?(view: View, before: View | null, presence: SeatPresence | null): void;
  /**
   * The game's Flight Log for the account's history page (its own data and texts; it loads
   * the account's records itself through `PlatformApi.flightLog`).
   */
  History?: ComponentType;
  /** The player left the room: forget the game's own UI state. */
  reset?(): void;
  /** The text for a code the server sent (a rule's reason), or `undefined` if not the game's. */
  errorText?(code: string): string | undefined;
}
