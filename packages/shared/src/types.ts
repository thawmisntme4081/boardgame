export type Seat = 'pilot' | 'copilot';

export const SEATS: readonly Seat[] = ['pilot', 'copilot'];

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

export interface Die {
  id: string;
  value: DieValue;
}

export type SlotId =
  | 'axisPilot'
  | 'axisCopilot'
  | 'enginePilot'
  | 'engineCopilot'
  | 'radioPilot'
  | 'radioCopilot1'
  | 'radioCopilot2'
  | 'gear1'
  | 'gear2'
  | 'gear3'
  | 'brakes1'
  | 'brakes2'
  | 'brakes3'
  | 'flaps1'
  | 'flaps2'
  | 'flaps3'
  | 'flaps4'
  | 'concentration1'
  | 'concentration2'
  | 'concentration3';

/** `strategy`: talking allowed, dice not rolled yet. `placing`: dice rolled, silence. */
export type Phase = 'strategy' | 'placing' | 'won' | 'lost';

export type EndReason =
  | 'spin' // axis reached an X
  | 'collision' // advanced while planes were in the current position
  | 'overshoot' // advanced past the airport
  | 'missed-airport' // reached the last altitude before the airport
  | 'mandatory-missing' // a round ended without both axis and both engine dice
  | 'landing-traffic' // planes left on the approach track
  | 'landing-gear' // not all landing gear deployed
  | 'landing-flaps' // not all flaps deployed
  | 'landing-axis' // plane not level
  | 'landing-brakes'; // final speed not below the brakes

export interface PlacedDie {
  seat: Seat;
  dieId: string;
  /** Value after coffee modifiers. */
  value: DieValue;
}

export interface AltitudeSpace {
  altitude: number;
  /** Seat shown by the arrow: who places the first die this round. */
  first: Seat;
  reroll: boolean;
}

export interface Scenario {
  id: string;
  name: string;
  /** One space per round, top (first round) to bottom (final round). */
  altitudes: AltitudeSpace[];
  /** Airplane tokens per approach space; index 0 is the start, the last index is the airport. */
  approach: number[];
}

/** What a client sends to place a die. */
export interface PlaceIntent {
  dieId: string;
  slot: SlotId;
  /** Net coffee modifier; each token spent is +1 or -1. */
  coffeeDelta: number;
}

export type GameEvent =
  | { type: 'roll'; round: number; dice: Record<Seat, Die[]> }
  | {
      type: 'place';
      round: number;
      seat: Seat;
      dieId: string;
      slot: SlotId;
      coffeeDelta: number;
      value: DieValue;
    }
  | { type: 'reroll-spent'; round: number; seat: Seat }
  | { type: 'reroll'; round: number; seat: Seat; dice: Die[] }
  | { type: 'round-end'; round: number }
  | { type: 'game-end'; round: number; result: 'won' | 'lost'; reason?: EndReason };

export interface GameState {
  scenario: Scenario;
  phase: Phase;
  /** 1-based; round N is played at `scenario.altitudes[N - 1]`. */
  round: number;
  /** Whose turn it is to place a die (the round's first seat during `strategy`). */
  currentSeat: Seat | null;
  /** Unplaced dice behind each screen. Secret: never sent to the partner. */
  dice: Record<Seat, Die[]>;
  placed: Partial<Record<SlotId, PlacedDie>>;
  /** Positive tilts toward the pilot, negative toward the co-pilot. */
  axis: number;
  approachIndex: number;
  approachPlanes: number[];
  /** Blue marker sits between `aeroBlue` and `aeroBlue + 1`. */
  aeroBlue: number;
  /** Orange marker sits between `aeroOrange` and `aeroOrange + 1`. */
  aeroOrange: number;
  gear: [boolean, boolean, boolean];
  flaps: [boolean, boolean, boolean, boolean];
  /** Number of brakes deployed, 0..3. */
  brakes: number;
  coffee: number;
  /** Reroll tokens in the supply. */
  rerolls: number;
  /** Seats that may still reroll after a token was spent this round. */
  rerollPending: Record<Seat, boolean>;
  /** Engine sum this round, once both engine dice are placed. */
  speed: number | null;
  rngSeed: number;
  rngState: number;
  log: GameEvent[];
  endReason?: EndReason;
  /** Every failed landing condition when the final round is lost. */
  landingFailures?: EndReason[];
}

export type MoveError =
  | 'game-over'
  | 'not-placing'
  | 'not-strategy'
  | 'not-your-turn'
  | 'unknown-die'
  | 'unknown-slot'
  | 'slot-taken'
  | 'wrong-seat'
  | 'bad-coffee'
  | 'not-enough-coffee'
  | 'value-out-of-range'
  | 'value-not-allowed'
  | 'out-of-order'
  | 'no-reroll'
  | 'reroll-pending'
  | 'no-reroll-pending'
  | 'bad-reroll';

export type MoveCheck = { ok: true } | { ok: false; reason: MoveError };
