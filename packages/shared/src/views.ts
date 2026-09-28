import { currentAltitude, isFinalRound, otherSeat } from './rules';
import type { Die, EndReason, GameState, Phase, PlacedDie, Scenario, Seat, SlotId } from './types';

/** Everything one player may see. Built only by `viewFor`. */
export interface PlayerView {
  seat: Seat;
  scenario: Scenario;
  phase: Phase;
  round: number;
  altitude: number;
  finalRound: boolean;
  currentSeat: Seat | null;
  /** Your own unplaced dice, with values. */
  myDice: Die[];
  /** The partner's unplaced dice: a count only. */
  partnerDiceLeft: number;
  placed: Partial<Record<SlotId, PlacedDie>>;
  axis: number;
  approachIndex: number;
  approachPlanes: number[];
  aeroBlue: number;
  aeroOrange: number;
  gear: [boolean, boolean, boolean];
  flaps: [boolean, boolean, boolean, boolean];
  brakes: number;
  coffee: number;
  rerolls: number;
  rerollPending: Record<Seat, boolean>;
  speed: number | null;
  endReason?: EndReason;
  landingFailures?: EndReason[];
}

/**
 * The only way game state leaves the server. Never includes the partner's die values,
 * the RNG seed or state, or the move log (which records every roll).
 */
export function viewFor(state: GameState, seat: Seat): PlayerView {
  const view: PlayerView = {
    seat,
    scenario: structuredClone(state.scenario),
    phase: state.phase,
    round: state.round,
    altitude: currentAltitude(state).altitude,
    finalRound: isFinalRound(state),
    currentSeat: state.currentSeat,
    myDice: structuredClone(state.dice[seat]),
    partnerDiceLeft: state.dice[otherSeat(seat)].length,
    placed: structuredClone(state.placed),
    axis: state.axis,
    approachIndex: state.approachIndex,
    approachPlanes: [...state.approachPlanes],
    aeroBlue: state.aeroBlue,
    aeroOrange: state.aeroOrange,
    gear: [...state.gear],
    flaps: [...state.flaps],
    brakes: state.brakes,
    coffee: state.coffee,
    rerolls: state.rerolls,
    rerollPending: { ...state.rerollPending },
    speed: state.speed,
  };
  if (state.endReason) view.endReason = state.endReason;
  if (state.landingFailures) view.landingFailures = [...state.landingFailures];
  return view;
}
