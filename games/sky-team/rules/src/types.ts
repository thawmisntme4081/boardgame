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
  | 'concentration3'
  // Module slots: only in scenarios with that module (see `SlotDef.module`).
  | 'kerosene'
  | 'internPilot'
  | 'internCopilot'
  | 'ice2Top'
  | 'ice2Bottom'
  | 'ice3Top'
  | 'ice3Bottom'
  | 'ice4Top'
  | 'ice4Bottom'
  | 'ice5Top'
  | 'ice5Bottom'
  | 'alarmConcentration'
  | 'alarmBrakes'
  | 'alarmGear'
  | 'alarmFlaps'
  | 'alarmRadioPilot'
  | 'alarmRadioCopilot';

/** Turbulence Alarm tokens, named after the Action each one blocks while face up. */
export type AlarmId = 'concentration' | 'brakes' | 'gear' | 'flaps' | 'radioPilot' | 'radioCopilot';

/** Turbulence replacement altitude tracks (A, B on the green/yellow side, C, D on red/black). */
export type AltitudeTrackId = 'A' | 'B' | 'C' | 'D';

/** Scenario color in the Flight Log: Routine, Exceptional, Elite, Heroic. */
export type Difficulty = 'green' | 'yellow' | 'red' | 'black';

export type ModuleId =
  | 'kerosene'
  | 'kerosene-leak'
  | 'intern'
  | 'wind'
  | 'wind-reversed'
  | 'real-time'
  | 'ice-brakes'
  | 'altitude-5000'
  | 'engines-out'
  | 'alarms'
  | 'total-trust'
  | 'belly-landing';

export type AbilityId =
  'adaptation' | 'anticipation' | 'control' | 'mastery' | 'synchronization' | 'working-together';

/**
 * `setup`: before round 1, the crew chooses roles and Special Abilities (online play).
 * `strategy`: talking allowed, dice not rolled yet. `placing`: dice rolled, silence.
 */
export type Phase = 'setup' | 'strategy' | 'placing' | 'won' | 'lost';

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
  | 'landing-brakes' // final speed not below the brakes
  | 'time-up' // a timed game's round ran out of time before all dice were placed
  | 'kerosene' // the kerosene marker reached the X
  | 'turn' // advanced with the axis outside a turn's permitted positions
  | 'landing-intern' // intern tokens left on the board
  | 'landing-ice-brakes'; // ice brakes not deployed past the 5

/** Weather on an altitude space (Turbulence tracks A–D), applied to the round played there. */
export interface AltitudeEvents {
  /** Every die you place on an Action rerolls your remaining dice. */
  turbulence?: boolean;
  /** Each player holds only 2 dice; the next two placements each bring in a set-aside die. */
  badVisibility?: boolean;
}

export interface PlacedDie {
  seat: Seat;
  dieId: string;
  /** Value after coffee modifiers. */
  value: DieValue;
  /** Not one of the seat's own dice: an Intern token or the Synchronization traffic die. */
  source?: 'intern' | 'traffic';
}

export interface AltitudeSpace extends AltitudeEvents {
  altitude: number;
  /** Seat shown by the arrow: who places the first die this round. */
  first: Seat;
  reroll: boolean;
}

export interface Scenario {
  /** `yul`, `lhr-green`, `lhr-yellow`, … */
  id: string;
  /** International code, e.g. `LHR`. */
  airport: string;
  name: string;
  difficulty: Difficulty;
  /** One space per round, top (first round) to bottom (final round). */
  altitudes: AltitudeSpace[];
  /** Airplane tokens per approach space; index 0 is the start, the last index is the airport. */
  approach: number[];
  /** Traffic die icons per approach space (absent: none). */
  traffic?: number[];
  /**
   * Turns: the axis positions allowed when the approach track advances from each space
   * (`null` or absent: any position).
   */
  turns?: (readonly number[] | null)[];
  /** Alarms: Alarm symbols per approach space (absent: none); needs the `alarms` module. */
  alarms?: number[];
  /** Total Trust: symbols per approach space (absent: none); needs the `total-trust` module. */
  totalTrust?: number[];
  /** Turbulence: the replacement altitude track (absent: the color's standard track). */
  altitudeTrack?: AltitudeTrackId;
  modules: ModuleId[];
  /** How many Special Ability cards the players choose (0, 1 or 2). */
  abilities: number;
  /** Track values not yet checked against the printed tiles. */
  placeholder?: boolean;
}

/** What a client sends to place a die. */
export interface PlaceIntent {
  dieId: string;
  slot: SlotId;
  /** Net coffee modifier; each token spent is +1 or -1. */
  coffeeDelta: number;
  /** Intern: where the token taken from the Intern board goes. */
  tokenSlot?: SlotId;
}

/** One roll of the traffic die at the start of a round. */
export interface TrafficRoll {
  roll: DieValue;
  /** Approach space that got the plane, or `null` when the box had none left. */
  space: number | null;
}

/** A special ability a player uses (the automatic ones need no action). */
export interface AbilityAction {
  ability: 'adaptation' | 'anticipation' | 'working-together';
  dieId: string;
}

/** Special abilities used so far: per game (Adaptation) or this round (the rest). */
export interface AbilityUse {
  adaptation: Record<Seat, boolean>;
  anticipation: boolean;
  workingTogether: boolean;
  synchronization: boolean;
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
      tokenSlot?: SlotId;
    }
  | { type: 'reroll-spent'; round: number; seat: Seat }
  | { type: 'reroll'; round: number; seat: Seat; dice: Die[] }
  /** Traffic die rolls at the start of a round; planes went to `approachIndex + roll - 1`. */
  | { type: 'traffic'; round: number; rolls: number[] }
  /** Synchronization: the traffic die the co-pilot must place. */
  | { type: 'bonus-die'; round: number; die: Die }
  /** A die changed by an ability (flipped, rerolled or swapped); `value` is its new value. */
  | {
      type: 'ability';
      round: number;
      seat: Seat;
      ability: AbilityId;
      dieId: string;
      value: DieValue;
    }
  /** Working Together: the offering player took their offer back. */
  | { type: 'swap-cancelled'; round: number; seat: Seat }
  /** Turbulence or Bad Visibility changed a player's hand after a placement: the new hand. */
  | { type: 'weather'; round: number; seat: Seat; dice: Die[] }
  /** Alarms: a token flipped face up at the start of a round. */
  | { type: 'alarm'; round: number; alarm: AlarmId }
  | { type: 'round-end'; round: number }
  | { type: 'game-end'; round: number; result: 'won' | 'lost'; reason?: EndReason };

/** The crew's choices, made with the seats the platform knows about. */
export interface Crew {
  /** The seat of the player who created the game: picks the card when there is only one. */
  host: Seat;
  /** Who is at the table. */
  seated: Record<Seat, boolean>;
  /** Before round 1: the host has chosen who flies which seat. */
  rolesChosen: boolean;
  /** Before round 1: the Special Ability card each player picked (kept for a rematch). */
  picks: Record<Seat, AbilityId | null>;
  /** Before round 1: happy with the roles and abilities. */
  confirmed: Record<Seat, boolean>;
  /** Strategy phase: done talking; the dice roll once both are ready. */
  ready: Record<Seat, boolean>;
}

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
  /** Left to right -2 -1 0 1 2: negative tilts toward the pilot (left), positive toward the co-pilot. */
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
  /** Who spent the current reroll token, until the next round starts. */
  rerollBy: Seat | null;
  /** The most recent reroll, used only to animate the dice its owner chose. */
  lastReroll: { seat: Seat; dieIds: string[] } | null;
  /** Engine sum this round, once both engine dice are placed. */
  speed: number | null;
  /** The finished round's board (dice and speed), kept until the next roll so players can look back. */
  lastRound: { placed: Partial<Record<SlotId, PlacedDie>>; speed: number | null } | null;
  rngSeed: number;
  rngState: number;
  /** Special Ability cards in play, chosen when the game is created. */
  abilities: AbilityId[];
  abilityUse: AbilityUse;
  /** Kerosene and Kerosene leak: fuel left (the X is 0); `null` without those modules. */
  kerosene: number | null;
  /** Intern: tokens still on the Intern board, pilot's end first; `null` without the module. */
  intern: DieValue[] | null;
  /** Wind: the Wind Ring space the blue airplane points at (0 is the white center); `null` without the module. */
  wind: number | null;
  /** Alarms: tokens face up (blocking their Action) and still face down; `null` without the module. */
  alarms: { active: AlarmId[]; faceDown: AlarmId[] } | null;
  /** Total Trust: this round has no strategy discussion; the dice roll by themselves. */
  autoRoll: boolean;
  /** Bad Visibility: dice each player has set aside, brought in one per placement. */
  setAside: Record<Seat, number>;
  /** Airplane tokens left in the box, for the traffic die. */
  planeSupply: number;
  /** The traffic die rolls at the start of this round (empty when the space had no icon). */
  traffic: TrafficRoll[];
  /** Synchronization: the traffic die the co-pilot must place now, and whose turn it interrupted. */
  bonus: { die: Die; after: Seat } | null;
  /** Working Together: the die a player put on the card, waiting for the partner's die. */
  swap: { seat: Seat; dieId: string; value: DieValue } | null;
  /** Timed games: how long each round's dice placement may take; `null` for no timer. */
  timerMs: number | null;
  /** When the current round's time runs out (ms since epoch), while a timed round is placing. */
  deadline: number | null;
  /** Total Trust: when the dice roll by themselves (ms since epoch), while such a strategy phase waits. */
  autoRollAt: number | null;
  /** Total Trust: the pause between the end of a round and the automatic roll. */
  autoRollDelayMs: number;
  /** The crew's choices before round 1, and who is ready to roll. All public. */
  crew: Crew;
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
  | 'bad-reroll'
  | 'slot-not-allowed'
  | 'no-intern-token'
  | 'intern-same-value'
  | 'bad-token-slot'
  | 'bonus-pending'
  | 'swap-pending'
  | 'ability-unavailable'
  | 'ability-used'
  | 'not-first-player'
  | 'first-die-placed'
  | 'no-partner-dice'
  | 'dice-limit'
  | 'not-setup'
  // Before round 1: roles and Special Abilities.
  | 'setup-closed'
  | 'not-your-pick'
  | 'ability-taken'
  | 'abilities-missing'
  | 'no-partner'
  | 'roles-missing'
  | 'alarm-blocked'
  | 'alarm-not-active'
  | 'no-swap';

export type MoveCheck = { ok: true } | { ok: false; reason: MoveError };
