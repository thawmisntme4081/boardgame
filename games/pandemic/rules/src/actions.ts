// The player actions of a turn: four per turn, and a reason code for every refusal.
import { answeringPawn, checkCarry, moveWith, type Carry } from './carry';
import { cityOf, type CityId, type Color } from './cities';
import { checkCure, discoverCure, helpersOf, type CureAction } from './cure';
import { actingPawn } from './pawns';
import { roleOf } from './roles';
import {
  ACTIONS_PER_TURN,
  CARDS_TO_CURE,
  MAX_STATIONS,
  type ActionState,
  type GameState,
  type HandCard,
  type PawnId,
  type SeatId,
  type Turn,
  pawnOwner,
  pawnsOnMap,
} from './types';

// Every action works on the pawn chosen for the turn (`actingPawn`: the seat's own, or a Teacher's
// student). The moves of a pawn carry `pawn` when it is another one (`movesPawns`: the Dispatcher
// moves other players' pawns), and `carry` when the player's own pawn takes cubes and a pawn
// along (`carries`: the Relocation Specialist); the cards always come from the hand of the
// player who acts.
export type Action =
  /** Drive / Ferry: to a city joined by a white line. */
  | { type: 'drive'; to: CityId; pawn?: PawnId; carry?: Carry }
  /** Direct Flight: discard the card of the city you fly to. */
  | { type: 'direct'; to: CityId; pawn?: PawnId; carry?: Carry }
  /** Charter Flight: discard the card of the city the pawn is in, fly anywhere. */
  | { type: 'charter'; to: CityId; pawn?: PawnId; carry?: Carry }
  /** Shuttle Flight: from a station to another station. */
  | { type: 'shuttle'; to: CityId; pawn?: PawnId; carry?: Carry }
  /** A pawn (yours or another's) to a city with another pawn (`movesPawns`: Dispatcher). */
  | { type: 'join'; to: CityId; pawn?: PawnId; carry?: Carry }
  /** Build a Research Station; `move` names the station to take away once all 6 are built. */
  | { type: 'build'; move?: CityId }
  /** Treat Disease: one cube, or all of a cured color. */
  | { type: 'treat'; color: Color }
  /**
   * Discover a Cure: discard these city cards (all of the color) at a research station, with
   * other players' cards when a role allows (`help`, see `cure.ts`).
   */
  | CureAction
  /** Give up the rest of the actions. */
  | { type: 'pass' };

export type ActionReason =
  | 'game-over'
  | 'not-your-turn'
  | 'wrong-step'
  | 'answer-first'
  | 'no-actions-left'
  | 'same-city'
  | 'not-adjacent'
  | 'card-missing'
  | 'no-station'
  | 'station-exists'
  | 'bad-station-to-move'
  | 'no-cubes'
  | 'already-cured'
  | 'bad-cards'
  // The pawn for the turn (see pawns.ts)
  | 'choose-pawn-first'
  | 'pawn-chosen'
  | 'not-your-pawn'
  // Roles (see roles/)
  | 'wrong-role'
  | 'power-used'
  | 'no-pawn-there'
  | 'event-stored'
  | 'no-event'
  | 'teacher-pawn-only'
  | 'no-students-left'
  | 'too-many-cubes'
  // Event cards (see playEvent.ts)
  | 'card-resolving'
  | 'not-playable'
  | 'no-forecast'
  | 'bad-order'
  // Share Knowledge (see share.ts)
  | 'bad-partner'
  | 'not-together'
  | 'no-offer'
  | 'not-your-answer'
  // Turn steps (see turn.ts)
  | 'nothing-to-discard'
  // Before the game (see preflight.ts)
  | 'already-confirmed'
  | 'cannot-restart'
  | 'not-confirmed'
  | 'pick-first'
  | 'roles-dealt'
  | 'role-taken'
  // The table (see table.ts)
  | 'bad-seat'
  | 'room-full'
  | 'not-started';

/** The actions that move a pawn. */
export type PawnMove = Extract<
  Action,
  { type: 'drive' | 'direct' | 'charter' | 'shuttle' | 'join' }
>;

const PAWN_MOVES: readonly string[] = ['drive', 'direct', 'charter', 'shuttle', 'join'];
export const isPawnMove = (action: { type: string }): action is PawnMove =>
  PAWN_MOVES.includes(action.type);

export type ActionCheck = { ok: true } | { ok: false; reason: ActionReason };

const OK: ActionCheck = { ok: true };
const fail = (reason: ActionReason): ActionCheck => ({ ok: false, reason });

export const hasCityCard = (hand: readonly HandCard[] | undefined, city: CityId): boolean =>
  (hand ?? []).some((card) => card.kind === 'city' && card.city === city);

/** Cubes of a color on the whole map. */
export function cubesOnBoard(state: Pick<GameState, 'cubes'>, color: Color): number {
  let total = 0;
  for (const cubes of Object.values(state.cubes)) total += cubes[color];
  return total;
}

/** Actions a turn of `seat` starts with (a role may change it), read when the turn starts. */
export const actionsPerTurn = (
  state: Pick<GameState, 'roles' | 'pawns' | 'cubes'>,
  seat: SeatId,
): number => roleOf(state, seat)?.actionsPerTurn?.(state, seat) ?? ACTIONS_PER_TURN;

/** City cards `seat` needs to discover a cure (a role may change it). */
export const cardsToCure = (state: Pick<ActionState, 'roles'>, seat: SeatId): number =>
  roleOf(state, seat)?.cardsToCure ?? CARDS_TO_CURE;

/**
 * Whether a research station may go in `city` (Build, Government Grant): none there yet, and
 * once all 6 are built, `move` names the one taken away (and only then).
 */
export function checkStationPlace(
  state: Pick<ActionState, 'stations'>,
  city: CityId,
  move: CityId | undefined,
): ActionCheck {
  if (state.stations.includes(city)) return fail('station-exists');
  if (state.stations.length >= MAX_STATIONS) {
    return move !== undefined && state.stations.includes(move) ? OK : fail('bad-station-to-move');
  }
  return move === undefined ? OK : fail('bad-station-to-move');
}

/** Puts a research station in `city` (it was checked), taking `move` away if given. */
export function placeStation(state: GameState, city: CityId, move: CityId | undefined): void {
  if (move !== undefined) state.stations = state.stations.filter((c) => c !== move);
  state.stations.push(city);
}

/**
 * The checks every action shares: the game is on, it is `seat`'s actions step, its pawn for the
 * turn is chosen, one action is left.
 */
export function checkTurnAction(state: ActionState, seat: SeatId): ActionCheck {
  if (state.status !== 'playing') return fail('game-over');
  if (state.turn.seat !== seat) return fail('not-your-turn');
  if (state.pending) return fail('answer-first');
  if (state.turn.step !== 'actions') return fail('wrong-step');
  if (state.turn.pawn === null) return fail('choose-pawn-first');
  if (state.turn.actionsLeft <= 0) return fail('no-actions-left');
  return OK;
}

/** Whether a move of `pawn` by `seat` is only an offer: the pawn is another player's. */
export const isMoveOffer = (seat: SeatId, pawn: PawnId): boolean => pawnOwner(pawn) !== seat;

/**
 * A pawn move by `seat`, the turn checks aside: whose pawn, from where, paid with which card,
 * and what it takes along (only the pawn's own player chooses that with the move).
 */
function checkPawnMove(state: ActionState, seat: SeatId, action: PawnMove): ActionCheck {
  const own = actingPawn(state, seat);
  const pawn = action.pawn ?? own;
  if (pawn !== own || action.type === 'join') {
    if (!roleOf(state, seat)?.movesPawns) return fail('wrong-role');
    if (state.pawns[pawn] === undefined) return fail('bad-partner');
  }
  const route = checkRoute(state, seat, pawn, action);
  if (!route.ok || action.carry === undefined) return route;
  return pawnOwner(pawn) === seat ? checkCarry(state, pawn, action.carry) : fail('wrong-role');
}

/** Whether `pawn` can go to `action.to` the way the action says, paid from `seat`'s hand. */
function checkRoute(state: ActionState, seat: SeatId, pawn: PawnId, action: PawnMove): ActionCheck {
  const from = state.pawns[pawn] as CityId;
  const hand = state.hands[seat];
  if (action.to === from) return fail('same-city');
  switch (action.type) {
    case 'drive':
      return cityOf(from).links.includes(action.to) ? OK : fail('not-adjacent');
    case 'direct':
      return hasCityCard(hand, action.to) ? OK : fail('card-missing');
    case 'charter':
      return hasCityCard(hand, from) ? OK : fail('card-missing');
    case 'shuttle':
      return state.stations.includes(from) && state.stations.includes(action.to)
        ? OK
        : fail('no-station');
    case 'join':
      return pawnsOnMap(state).some((other) => other !== pawn && state.pawns[other] === action.to)
        ? OK
        : fail('no-pawn-there');
  }
}

export function checkAction(state: ActionState, seat: SeatId, action: Action): ActionCheck {
  const turn = checkTurnAction(state, seat);
  if (!turn.ok) return turn;
  if (isPawnMove(action)) return checkPawnMove(state, seat, action);

  const role = roleOf(state, seat);
  const here = state.pawns[actingPawn(state, seat)] as CityId;
  const hand = state.hands[seat];
  switch (action.type) {
    case 'pass':
      return OK;
    case 'build':
      if (state.stations.includes(here)) return fail('station-exists');
      if (!role?.buildsWithoutCard && !hasCityCard(hand, here)) return fail('card-missing');
      return checkStationPlace(state, here, action.move);
    case 'treat':
      return state.cubes[here][action.color] > 0 ? OK : fail('no-cubes');
    case 'cure':
      return checkCure(state, seat, action);
  }
}

/** Takes one card of a city out of a hand and onto the player discard pile. */
export function discardCity(state: GameState, seat: SeatId, city: CityId): void {
  const hand = state.hands[seat] as HandCard[];
  const index = hand.findIndex((card) => card.kind === 'city' && card.city === city);
  state.playerDiscard.push(...hand.splice(index, 1));
}

/** Spends one action; with none left, the actions part of the turn is over. */
export function spendAction(turn: Turn): void {
  turn.actionsLeft -= 1;
  if (turn.actionsLeft <= 0) turn.step = 'draw';
}

/** Eradicated: cured, and no cube of the color left on the map. */
export function checkEradicated(state: GameState, color: Color): void {
  if (state.cures[color] === 'cured' && cubesOnBoard(state, color) === 0) {
    state.cures[color] = 'eradicated';
  }
}

/**
 * Puts a pawn in a city, however it got there (any move, the Dispatcher, Airlift); its role
 * reacts to arriving. Only a seat's own pawn has a role: a Teacher's student has no power.
 */
export function movePawn(state: GameState, pawn: PawnId, to: CityId): void {
  state.pawns[pawn] = to;
  const owner = pawnOwner(pawn);
  if (pawn === owner) roleOf(state, owner)?.onEnterCity?.(state, owner);
}

/**
 * Does a pawn move by `mover` (it was checked): pays its card from `mover`'s hand, moves the pawn
 * with what it takes along.
 */
export function doPawnMove(state: GameState, mover: SeatId, action: PawnMove): void {
  const pawn = action.pawn ?? actingPawn(state, mover);
  if (action.type === 'direct') discardCity(state, mover, action.to);
  if (action.type === 'charter') discardCity(state, mover, state.pawns[pawn] as CityId);
  moveWith(state, pawn, action.to, action.carry);
}

/**
 * Does the action (it must be legal: see `checkAction`) and returns the new state. Moving
 * another player's pawn, or taking one along, is only offered: its owner answers (see
 * `moveOffer.ts`).
 */
export function applyAction(state: GameState, seat: SeatId, action: Action): GameState {
  const check = checkAction(state, seat, action);
  if (!check.ok) throw new Error(`Illegal action ${action.type}: ${check.reason}`);

  const s = structuredClone(state);
  if (isPawnMove(action)) {
    const answering = answeringPawn(seat, action.pawn ?? actingPawn(s, seat), action.carry);
    if (answering !== null) {
      s.pending = { kind: 'move', by: seat, pawn: answering, move: action };
      return s;
    }
    doPawnMove(s, seat, action);
    spendAction(s.turn);
    return s;
  }

  const here = s.pawns[actingPawn(s, seat)] as CityId;
  const role = roleOf(s, seat);
  switch (action.type) {
    case 'pass':
      s.turn.actionsLeft = 0;
      s.turn.step = 'draw';
      return s;
    case 'build':
      if (!role?.buildsWithoutCard) discardCity(s, seat, here);
      placeStation(s, here, action.move);
      break;
    case 'treat': {
      const cubes = s.cubes[here];
      const all = s.cures[action.color] !== 'none' || role?.treatsAll;
      const removed = all ? cubes[action.color] : 1;
      cubes[action.color] -= removed;
      s.supply[action.color] += removed;
      checkEradicated(s, action.color);
      break;
    }
    case 'cure':
      // Other players' cards: they agree first (`cure.ts`).
      if (helpersOf(action).length > 0) {
        s.pending = { kind: 'cure', by: seat, move: action, waiting: helpersOf(action) };
        return s;
      }
      discoverCure(s, seat, action);
      break;
  }
  spendAction(s.turn);
  return s;
}
