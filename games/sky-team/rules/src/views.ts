import { checkAbility, checkCancelSwap, type AbilityContext } from './abilities';
import {
  checkPlacement,
  checkTurn,
  currentAltitude,
  isFinalRound,
  otherSeat,
  roundTimeLeft,
} from './rules';
import type {
  AbilityAction,
  AbilityId,
  AbilityUse,
  Die,
  DieValue,
  EndReason,
  GameState,
  MoveCheck,
  Phase,
  PlaceIntent,
  PlacedDie,
  Scenario,
  Seat,
  SlotId,
  TrafficRoll,
} from './types';

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
  /** The partner's unplaced dice (set-aside ones included): a count only. */
  partnerDiceLeft: number;
  /** Bad Visibility: dice each player still has set aside (public: never rolled yet). */
  setAside: Record<Seat, number>;
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
  /** Who spent the token that opened the current reroll. */
  rerollBy: Seat | null;
  /** Your own dice selected in the last reroll; partner dice remain secret. */
  rerolledDice: string[];
  speed: number | null;
  /** The finished round's dice and speed, until the next roll. */
  lastRound: GameState['lastRound'];
  endReason?: EndReason;
  landingFailures?: EndReason[];
  timerMs: number | null;
  roundTimeLeftMs: number | null;
  abilities: AbilityId[];
  abilityUse: AbilityUse;
  kerosene: number | null;
  intern: DieValue[] | null;
  wind: number | null;
  /** Alarms: face-up and face-down tokens (public: the flip is random when it happens). */
  alarms: GameState['alarms'];
  /** Total Trust: no strategy discussion this round; the server rolls the dice. */
  autoRoll: boolean;
  planeSupply: number;
  /** The traffic die rolls that started this round (public: rolled in the open). */
  traffic: TrafficRoll[];
  /** Synchronization's traffic die (rolled in the open) waiting for the co-pilot. */
  bonus: { die: Die } | null;
  /** Working Together: the die on the card is face up, so both players see its value. */
  swap: { seat: Seat; value: DieValue } | null;
  /** The crew's choices (roles, picks, confirms, ready): public. */
  crew: GameState['crew'];
  /** The round's latest placed die (public: it is on the board), or `null` before the first. */
  lastPlace: { seat: Seat; slot: SlotId; value: DieValue } | null;
}

/** The latest die placed this round, from the log (the die's id and the log stay secret). */
function lastPlaceOf(state: GameState): PlayerView['lastPlace'] {
  for (let i = state.log.length - 1; i >= 0; i--) {
    const event = state.log[i]!;
    if (event.round !== state.round) return null;
    if (event.type === 'place') return { seat: event.seat, slot: event.slot, value: event.value };
  }
  return null;
}

/**
 * The only way game state leaves the server. Never includes the partner's die values,
 * the RNG seed or state, or the move log (which records every roll).
 */
export function viewFor(state: GameState, seat: Seat, now = Date.now()): PlayerView {
  const view: PlayerView = {
    seat,
    scenario: structuredClone(state.scenario),
    phase: state.phase,
    round: state.round,
    altitude: currentAltitude(state).altitude,
    finalRound: isFinalRound(state),
    currentSeat: state.currentSeat,
    myDice: structuredClone(state.dice[seat]),
    partnerDiceLeft: state.dice[otherSeat(seat)].length + state.setAside[otherSeat(seat)],
    setAside: { ...state.setAside },
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
    rerollBy: state.rerollBy,
    rerolledDice: state.lastReroll?.seat === seat ? [...state.lastReroll.dieIds] : [],
    speed: state.speed,
    lastRound: structuredClone(state.lastRound),
    timerMs: state.timerMs,
    roundTimeLeftMs: roundTimeLeft(state, now),
    abilities: [...state.abilities],
    abilityUse: structuredClone(state.abilityUse),
    kerosene: state.kerosene,
    intern: state.intern && [...state.intern],
    wind: state.wind,
    alarms: structuredClone(state.alarms),
    autoRoll: state.autoRoll,
    planeSupply: state.planeSupply,
    traffic: state.traffic.map((t) => ({ ...t })),
    bonus: state.bonus && { die: { ...state.bonus.die } },
    swap: state.swap && { seat: state.swap.seat, value: state.swap.value },
    crew: structuredClone(state.crew),
    lastPlace: lastPlaceOf(state),
  };
  if (state.endReason) view.endReason = state.endReason;
  if (state.landingFailures) view.landingFailures = [...state.landingFailures];
  return view;
}

/** The client's copy of `canPlaceDie`: same rules, read from the player's own view. */
export function canPlaceInView(view: PlayerView, intent: PlaceIntent): MoveCheck {
  const turn = checkTurn(view.phase, view.currentSeat, view.seat);
  return turn.ok ? checkPlacement(view, intent) : turn;
}

const abilityContextOfView = (view: PlayerView): AbilityContext => ({
  ...view,
  firstSeat: currentAltitude(view).first,
});

/** The client's copy of `canUseAbility`, read from the player's own view. */
export const canUseAbilityInView = (view: PlayerView, action: AbilityAction): MoveCheck =>
  checkAbility(abilityContextOfView(view), action);

/** Whether this player can take back their Working Together offer. */
export const canCancelSwapInView = (view: PlayerView): MoveCheck => checkCancelSwap(view);
