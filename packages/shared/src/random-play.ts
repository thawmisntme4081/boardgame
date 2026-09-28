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

export type AgentAction =
  | { type: 'roll' }
  | { type: 'spend-reroll'; seat: Seat }
  | { type: 'reroll'; seat: Seat; dieIds: string[] }
  | { type: 'place'; seat: Seat; intent: PlaceIntent };

/**
 * A random player for both seats. It sees the whole state (it is a test tool), and its
 * choices use their own RNG stream so they never disturb the game's dice.
 * `careful` agents avoid obvious blunders; pure random agents rarely pass round 2.
 */
export function createRandomAgent(seed: number, careful = true) {
  let agentRng = seed ^ 0x5bd1e995;
  const rand = () => {
    const r = nextRandom(agentRng);
    agentRng = r.rngState;
    return r.value;
  };
  const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)]!;

  return (state: GameState): AgentAction => {
    if (state.phase === 'strategy') return { type: 'roll' };
    const pending = SEATS.find((seat) => state.rerollPending[seat]);
    if (pending) {
      const dieIds = state.dice[pending].filter(() => rand() < 0.5).map((d) => d.id);
      return { type: 'reroll', seat: pending, dieIds };
    }
    if (canSpendReroll(state).ok && rand() < 0.1) {
      return { type: 'spend-reroll', seat: pick([...SEATS]) };
    }
    const seat = state.currentSeat;
    if (!seat) throw new Error('placing phase without a current seat');
    const moves = legalMoves(state, seat);
    if (moves.length === 0) throw new Error(`${seat} is on turn with no legal move`);
    return { type: 'place', seat, intent: pick(careful ? carefulMoves(state, moves) : moves) };
  };
}

export function applyAgentAction(state: GameState, action: AgentAction): GameState {
  switch (action.type) {
    case 'roll':
      return rollDice(state);
    case 'spend-reroll':
      return spendReroll(state, action.seat);
    case 'reroll':
      return rerollDice(state, action.seat, action.dieIds);
    case 'place':
      return placeDie(state, action.seat, action.intent);
  }
}

export function playRandomGame(
  seed: number,
  scenario: Scenario = YUL,
  onStep?: (state: GameState) => void,
  careful = true,
): GameState {
  const agent = createRandomAgent(seed, careful);
  let state = createGame(scenario, seed);
  for (let step = 0; step < MAX_STEPS; step++) {
    onStep?.(state);
    if (isGameOver(state)) return state;
    state = applyAgentAction(state, agent(state));
  }
  throw new Error(`game with seed ${seed} did not finish in ${MAX_STEPS} steps`);
}
