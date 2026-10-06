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
}

export interface BoardProps<View> {
  view: View;
  presence: SeatPresence | null;
  connection: Connection;
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
  /** The player left the room: forget the game's own UI state. */
  reset?(): void;
  /** The text for a code the server sent (a rule's reason), or `undefined` if not the game's. */
  errorText?(code: string): string | undefined;
}
