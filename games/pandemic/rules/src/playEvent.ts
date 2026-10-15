// Event cards: any player holding one may play it at almost any moment, on their turn or not,
// and it is not an action. The rulebook allows events at any time "except in between drawing and
// resolving a card": every card of the turn is its own move, so the moments in between are the
// states between moves. What each card does is its module in `events/`.
import { isMoveOffer, type ActionCheck, type ActionReason } from './actions';
import { EVENTS, type PawnEventMove, type PlayEventMove } from './events';
import { roleOf } from './roles';
import { HAND_LIMIT, type ActionState, type EventId, type GameState, type SeatId } from './types';

const fail = (reason: ActionReason): { ok: false; reason: ActionReason } => ({ ok: false, reason });

/** Where a player keeps an event card: in hand, or on the role card (Contingency Planner). */
export type EventSource = 'hand' | 'role';

type Holder = Pick<ActionState, 'hands' | 'roles' | 'contingency'>;

/** Where `seat` holds `event`, or `null` if it does not. */
export function eventSource(state: Holder, seat: SeatId, event: EventId): EventSource | null {
  if ((state.hands[seat] ?? []).some((card) => card.kind === 'event' && card.event === event)) {
    return 'hand';
  }
  return state.contingency === event && roleOf(state, seat)?.storesEvent ? 'role' : null;
}

/** The event cards `seat` holds: those in hand, then the one on its role card. */
export function heldEvents(state: Holder, seat: SeatId): EventId[] {
  const inHand = (state.hands[seat] ?? []).flatMap((card) =>
    card.kind === 'event' ? [card.event] : [],
  );
  const stored = state.contingency !== null && roleOf(state, seat)?.storesEvent;
  return stored ? [...inHand, state.contingency as EventId] : inHand;
}

/**
 * Whether `seat` may play events now, whatever it holds: `pause` when only the events allowed
 * in an epidemic's pause may be played (between its Infect and Intensify steps).
 * - Nobody plays once the game is over.
 * - An open offer (Share Knowledge, a pawn move) or a Forecast being arranged comes first; a
 *   hand over the limit may be brought down by an event, by the player who discards only.
 * - From drawing an epidemic until it is resolved, no event; two epidemics drawn together allow
 *   events again once the first is resolved (the rulebook says so).
 */
export function eventMoment(
  state: ActionState,
  seat: SeatId,
): { ok: true; pause: boolean } | { ok: false; reason: ActionReason } {
  if (state.status !== 'playing') return fail('game-over');
  const { pending, turn } = state;
  if (pending && !(pending.kind === 'discard' && pending.seat === seat)) {
    return fail('answer-first');
  }
  if (turn.step === 'epidemic') {
    if (turn.epidemicStep === 'intensify') return { ok: true, pause: true };
    if (turn.epidemicStep === 'infect' || turn.epidemicsResolved === 0) {
      return fail('card-resolving');
    }
  }
  return { ok: true, pause: false };
}

/**
 * Whether `seat` may start playing `event`, a card held by `owner` (by default `seat` itself;
 * anyone may play anyone's card): the client enables its "Play" button with this; the choices the
 * card needs are checked by the move itself.
 */
export function canPlayCard(
  state: ActionState,
  seat: SeatId,
  event: EventId,
  owner: SeatId = seat,
): boolean {
  const moment = eventMoment(state, seat);
  if (!moment.ok || eventSource(state, owner, event) === null) return false;
  const module = EVENTS[event];
  if (moment.pause && !module.inEpidemicPause) return false;
  // A card with a second step needs nothing else pending (a hand-limit discard).
  return !(state.pending && module.twoSteps);
}

/** Whether `seat` may play an event card now: one of its own or of any other player's. */
export function canPlayEvent(state: ActionState, seat: SeatId): boolean {
  return state.seats.some((owner) =>
    heldEvents(state, owner).some((event) => canPlayCard(state, seat, event, owner)),
  );
}

/** An event that moves another player's pawn: an offer its owner answers (`moveOffer.ts`). */
export const isPawnOffer = (seat: SeatId, move: PlayEventMove): move is PawnEventMove =>
  'pawn' in move && isMoveOffer(seat, move.pawn);

export function checkPlayEvent(state: ActionState, seat: SeatId, move: PlayEventMove): ActionCheck {
  const moment = eventMoment(state, seat);
  if (!moment.ok) return moment;
  if (eventSource(state, move.owner ?? seat, move.event) === null) return fail('card-missing');
  const module = EVENTS[move.event];
  if (moment.pause && !module.inEpidemicPause) return fail('card-resolving');
  // A hand over the limit is brought down first: an offer would wait for an answer, and a
  // second step would have nowhere to go.
  if (state.pending && (isPawnOffer(seat, move) || module.twoSteps)) return fail('answer-first');
  return module.check(state, seat, move);
}

/**
 * Plays the event on `s` (a copy; the move was checked): the card goes to the player discard
 * pile, or out of the game from the role card, the log says who played it, then the card does
 * its work. A hand brought back to the limit owes no more discards. Also used when an offer is
 * accepted (`moveOffer.ts`).
 */
export function resolveEvent(s: GameState, seat: SeatId, move: PlayEventMove): void {
  // The card leaves its owner's hand (or role card); `seat` chooses what it does.
  const owner = move.owner ?? seat;
  const source = eventSource(s, owner, move.event);
  if (source === 'hand') {
    const hand = s.hands[owner] ?? [];
    const [card] = hand.splice(
      hand.findIndex((c) => c.kind === 'event' && c.event === move.event),
      1,
    );
    if (card) s.playerDiscard.push(card);
    if (s.pending?.kind === 'discard' && s.pending.seat === owner && hand.length <= HAND_LIMIT) {
      s.pending = null;
    }
  } else {
    s.contingency = null;
  }
  s.log.current.entries.push({
    type: 'event',
    seat,
    event: move.event,
    stored: source === 'role',
    ...(owner !== seat && { owner }),
    ...('pawn' in move && { pawn: move.pawn }),
    ...('to' in move && { city: move.to }),
    ...('city' in move && { city: move.city }),
  });
  EVENTS[move.event].apply(s, seat, move);
}

/**
 * Plays the event (it must be legal: see `checkPlayEvent`) and returns the new state. Moving
 * another player's pawn is only offered: the card stays in hand until its owner accepts.
 */
export function applyPlayEvent(state: GameState, seat: SeatId, move: PlayEventMove): GameState {
  const check = checkPlayEvent(state, seat, move);
  if (!check.ok) throw new Error(`Illegal play-event: ${check.reason}`);

  const s = structuredClone(state);
  if (isPawnOffer(seat, move)) {
    s.pending = { kind: 'move', by: seat, pawn: move.pawn, move };
  } else {
    resolveEvent(s, seat, move);
  }
  return s;
}
