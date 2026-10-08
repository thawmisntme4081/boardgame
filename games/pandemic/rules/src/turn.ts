// The parts of a turn after the actions: draw 2 cards, resolve epidemics, discard down to the
// hand limit, infect cities, then the next player's turn. Every card is its own move of the
// active player, so events (Pandemic 05) can be played between them.
import type { ActionCheck, ActionReason } from './actions';
import { infectCity, lose } from './outbreak';
import { shuffle } from './setup';
import {
  ACTIONS_PER_TURN,
  HAND_LIMIT,
  INFECTION_RATES,
  type ActionState,
  type GameState,
  type HandCard,
  type SeatId,
} from './types';
import type { CityId } from './cities';

export type TurnMove =
  /** Draw the top 2 cards of the player deck (end of the actions). */
  | { type: 'draw' }
  /** Do the next step of the epidemic being resolved: increase, infect, intensify. */
  | { type: 'epidemic' }
  /** Flip the next infection card and infect its city. */
  | { type: 'infect' }
  /** Discard a card from a hand over the limit. */
  | { type: 'discard'; card: HandCard };

const OK: ActionCheck = { ok: true };
const fail = (reason: ActionReason): ActionCheck => ({ ok: false, reason });

const sameCard = (a: HandCard, b: HandCard): boolean =>
  a.kind === 'city'
    ? b.kind === 'city' && b.city === a.city
    : b.kind === 'event' && b.event === a.event;

export function checkTurnMove(state: ActionState, seat: SeatId, move: TurnMove): ActionCheck {
  if (state.status !== 'playing') return fail('game-over');

  if (move.type === 'discard') {
    const { pending } = state;
    if (pending?.kind !== 'discard') return fail('nothing-to-discard');
    if (pending.seat !== seat) return fail('not-your-answer');
    return (state.hands[seat] ?? []).some((card) => sameCard(card, move.card))
      ? OK
      : fail('card-missing');
  }

  if (state.turn.seat !== seat) return fail('not-your-turn');
  if (state.pending) return fail('answer-first');
  const step = { draw: 'draw', epidemic: 'epidemic', infect: 'infect' }[move.type];
  return state.turn.step === step ? OK : fail('wrong-step');
}

/** Starts the infect step; a hand over the limit must be discarded to 7 first. */
function beginInfect(state: GameState): void {
  const { turn } = state;
  turn.step = 'infect';
  turn.infectionsLeft = INFECTION_RATES[state.infectionRate] as number;
  if ((state.hands[turn.seat] ?? []).length > HAND_LIMIT) {
    state.pending = { kind: 'discard', seat: turn.seat };
  }
}

function endTurn(state: GameState): void {
  const next = state.seats[(state.seats.indexOf(state.turn.seat) + 1) % state.seats.length];
  state.turn = {
    seat: next as SeatId,
    actionsLeft: ACTIONS_PER_TURN,
    step: 'actions',
    epidemics: 0,
    epidemicStep: 'increase',
    infectionsLeft: 0,
  };
}

/** Reshuffles the infection discard pile onto the top of the infection deck. */
function intensify(state: GameState): void {
  const shuffled = shuffle(state.infectionDiscard, state.rngState);
  state.rngState = shuffled.rngState;
  state.infectionDeck = [...shuffled.items, ...state.infectionDeck];
  state.infectionDiscard = [];
}

function draw(state: GameState): void {
  const { turn } = state;
  if (state.playerDeck.length < 2) {
    lose(state, 'player-deck');
    return;
  }
  for (const card of state.playerDeck.splice(0, 2)) {
    if (card.kind === 'epidemic') turn.epidemics += 1;
    else (state.hands[turn.seat] as HandCard[]).push(card);
  }
  if (turn.epidemics > 0) {
    turn.step = 'epidemic';
    turn.epidemicStep = 'increase';
  } else {
    beginInfect(state);
  }
}

function epidemic(state: GameState): void {
  const { turn } = state;
  switch (turn.epidemicStep) {
    case 'increase':
      state.infectionRate = Math.min(state.infectionRate + 1, INFECTION_RATES.length - 1);
      turn.epidemicStep = 'infect';
      return;
    case 'infect': {
      const bottom = state.infectionDeck.pop() as CityId;
      infectCity(state, bottom, 3);
      state.infectionDiscard.push(bottom);
      turn.epidemicStep = 'intensify';
      return;
    }
    case 'intensify':
      intensify(state);
      turn.epidemics -= 1;
      if (turn.epidemics > 0) turn.epidemicStep = 'increase';
      else beginInfect(state);
      return;
  }
}

function infect(state: GameState): void {
  const { turn } = state;
  // An empty deck flips nothing (it is not expected: epidemics refill it); the discard stays.
  const top = state.infectionDeck.shift();
  if (top !== undefined) {
    infectCity(state, top, 1);
    state.infectionDiscard.push(top);
  }
  turn.infectionsLeft -= 1;
  if (state.status === 'playing' && turn.infectionsLeft <= 0) endTurn(state);
}

/** Does the move (it must be legal: see `checkTurnMove`) and returns the new state. */
export function applyTurnMove(state: GameState, seat: SeatId, move: TurnMove): GameState {
  const check = checkTurnMove(state, seat, move);
  if (!check.ok) throw new Error(`Illegal ${move.type}: ${check.reason}`);

  const s = structuredClone(state);
  switch (move.type) {
    case 'draw':
      draw(s);
      break;
    case 'epidemic':
      epidemic(s);
      break;
    case 'infect':
      infect(s);
      break;
    case 'discard': {
      const hand = s.hands[seat] as HandCard[];
      const [card] = hand.splice(
        hand.findIndex((c) => sameCard(c, move.card)),
        1,
      );
      s.playerDiscard.push(card as HandCard);
      if (hand.length <= HAND_LIMIT) s.pending = null;
      break;
    }
  }
  return s;
}
