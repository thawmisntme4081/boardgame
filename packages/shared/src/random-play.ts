// Plays whole games with random legal moves, for fuzz tests and the random-play script.
import { nextRandom } from './rng';
import {
  canSpendReroll,
  isGameOver,
  legalMoves,
  otherSeat,
  placeDie,
  rerollDice,
  rollDice,
  spendReroll,
} from './rules';
import { YUL } from './scenarios';
import { MANDATORY_SLOTS, SLOTS } from './slots';
import { createGame } from './state';
import {
  SEATS,
  type GameState,
  type PlaceIntent,
  type Scenario,
  type Seat,
  type SlotId,
} from './types';

const MAX_STEPS = 1000;

/**
 * Narrows random moves so games last longer: settle axis/engines first with moves that
 * neither lose on the spot nor leave the partner without a safe reply, and fill the seat's
 * own mandatory spaces when it has no dice to spare. Coffee is left to the pure agent.
 */
function carefulMoves(state: GameState, moves: PlaceIntent[]): PlaceIntent[] {
  const seat = state.currentSeat!;
  const ownMandatory = MANDATORY_SLOTS.filter(
    (slot) => !state.placed[slot] && SLOTS[slot].seats.includes(seat),
  );
  const noCoffee = moves.filter((m) => m.coffeeDelta === 0);
  let pool = noCoffee.length > 0 ? noCoffee : moves;
  if (state.dice[seat].length <= ownMandatory.length) {
    pool = pool.filter((m) => ownMandatory.includes(m.slot));
  }
  // Settle the mandatory spaces first while a safe option exists.
  const safeMandatory = pool.filter((m) => {
    if (!MANDATORY_SLOTS.includes(m.slot)) return false;
    const after = placeDie(state, seat, m);
    return after.phase !== 'lost' && partnerCanAnswer(after, seat, m.slot);
  });
  if (safeMandatory.length > 0) return safeMandatory;
  const others = pool.filter((m) => !MANDATORY_SLOTS.includes(m.slot));
  return others.length > 0 ? others : pool.length > 0 ? pool : moves;
}

const COUNTERPART: Partial<Record<SlotId, SlotId>> = {
  axisPilot: 'axisCopilot',
  axisCopilot: 'axisPilot',
  enginePilot: 'engineCopilot',
  engineCopilot: 'enginePilot',
};

/** The agent sees both hands: after a first axis/engine die, can the partner reply without losing? */
function partnerCanAnswer(after: GameState, seat: Seat, slot: SlotId): boolean {
  const counterpart = COUNTERPART[slot];
  if (after.phase !== 'placing' || !counterpart || after.placed[counterpart]) return true;
  const partner = otherSeat(seat);
  const probe: GameState = { ...after, currentSeat: partner };
  return after.dice[partner].some(
    (d) =>
      placeDie(probe, partner, { dieId: d.id, slot: counterpart, coffeeDelta: 0 }).phase !== 'lost',
  );
}

/** `careful` agents avoid obvious blunders; pure random agents rarely pass round 2. */
export function playRandomGame(
  seed: number,
  scenario: Scenario = YUL,
  onStep?: (state: GameState) => void,
  careful = true,
): GameState {
  // The agent's choices use their own stream so they never disturb the game's dice.
  let agentRng = seed ^ 0x5bd1e995;
  const rand = () => {
    const r = nextRandom(agentRng);
    agentRng = r.rngState;
    return r.value;
  };
  const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)]!;

  let state = createGame(scenario, seed);
  for (let step = 0; step < MAX_STEPS; step++) {
    onStep?.(state);
    if (isGameOver(state)) return state;

    if (state.phase === 'strategy') {
      state = rollDice(state);
      continue;
    }
    const pending = SEATS.find((seat) => state.rerollPending[seat]);
    if (pending) {
      const ids = state.dice[pending].filter(() => rand() < 0.5).map((d) => d.id);
      state = rerollDice(state, pending, ids);
      continue;
    }
    if (canSpendReroll(state).ok && rand() < 0.1) {
      state = spendReroll(state, pick([...SEATS]));
      continue;
    }

    const seat = state.currentSeat;
    if (!seat) throw new Error('placing phase without a current seat');
    const moves = legalMoves(state, seat);
    if (moves.length === 0) throw new Error(`${seat} is on turn with no legal move`);
    state = placeDie(state, seat, pick(careful ? carefulMoves(state, moves) : moves));
  }
  throw new Error(`game with seed ${seed} did not finish in ${MAX_STEPS} steps`);
}
