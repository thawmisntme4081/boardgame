import type { PlacementContext } from '../rules';
import type {
  AltitudeSpace,
  DieValue,
  EndReason,
  GameState,
  ModuleId,
  MoveError,
  PlaceIntent,
  PlacedDie,
  Seat,
  SlotId,
} from '../types';

/** The core color/number/order check for anything placed on `slot` (`seat` null: any color). */
export type SlotCheck = (
  ctx: PlacementContext,
  seat: Seat | null,
  slot: SlotId,
  value: DieValue,
) => MoveError | null;

/** Puts a token (or bonus die) on `slot` and resolves it as if it were a die placed there. */
export type Resolver = (
  state: GameState,
  seat: Seat,
  slot: SlotId,
  value: DieValue,
  source: NonNullable<PlacedDie['source']>,
) => void;

/**
 * A game module from the Flight Log. The rules call these hooks at fixed points; a module
 * keeps its own state in `GameState` (`kerosene`, `intern`, `wind`, …) and only reacts to
 * its own slots (`SlotDef.module`). Hooks mutate the (already cloned) state they get.
 */
export interface RuleModule {
  id: ModuleId;
  /** Changes the scenario's altitude track before the game starts; called by `createGame`. */
  altitudes?(altitudes: AltitudeSpace[]): AltitudeSpace[];
  /** Sets the module's starting state; called by `createGame`. */
  setup?(state: GameState): void;
  /** Extra rule for anything placed on one of the module's slots (die, token or bonus die). */
  checkSlot?(ctx: PlacementContext, slot: SlotId, value: DieValue): MoveError | null;
  /** Extra rule for a player's own die placed on one of the module's slots. */
  checkMove?(
    ctx: PlacementContext,
    intent: PlaceIntent,
    value: DieValue,
    checkSlot: SlotCheck,
  ): MoveError | null;
  /** Effect of a die placed on one of the module's slots; returns a reason if the game is lost. */
  place?(
    state: GameState,
    seat: Seat,
    slot: SlotId,
    value: DieValue,
    extra: { tokenSlot?: SlotId; resolve: Resolver },
  ): EndReason | undefined;
  /** Right after the axis resolves (both axis dice placed). */
  afterAxis?(state: GameState): void;
  /** Added to the engine dice to give the speed. */
  speedBonus?(state: GameState): number;
  /** At the very end of the End of Round phase; returns a reason if the game is lost. */
  endOfRound?(state: GameState): EndReason | undefined;
  /** Landing conditions this module adds that failed. */
  landing?(state: GameState): EndReason[];
  /** Every landing condition this module adds (listed before landing; `landing` checks them). */
  landingConditions?: readonly Extract<EndReason, `landing-${string}`>[];
  /** Brake marker positions when the module replaces the brakes (landing speed must not exceed). */
  brakeThresholds?: readonly number[];
  /** How many of their dice each player may place per round (the rest are lost). */
  dicePerRound?: number;
  /** The Approach Track advances this many spaces at the end of every round but the final one. */
  approachPerRound?: number;
  /** No speed: landing skips the speed-against-brakes check. */
  noSpeed?: boolean;
  /** Real-time: when the round's time runs out, the round ends (instead of the game). */
  timeUpEndsRound?: boolean;
}
