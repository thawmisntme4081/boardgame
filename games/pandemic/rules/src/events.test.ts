// Pandemic 05: the five event cards, when they may be played (from any seat, almost any moment),
// each card's effect, the hand limit and the Contingency Planner's stored card.
import { describe, expect, it } from 'vitest';
import { pandemic, pandemicMoveSchema } from './definition';
import { applyMoveOffer, checkMoveOffer } from './moveOffer';
import { agentMove } from './random-play';
import { createGame } from './setup';
import { applyMove, canActInView, checkMove, type PandemicMove } from './moves';
import { canPlayCard, canPlayEvent, heldEvents } from './playEvent';
import { applyShare } from './share';
import { addCubes, blankGame, city, give } from './test-utils';
import { applyTurnMove } from './turn';
import { MAX_STATIONS, type EventId, type GameState, type SeatId } from './types';
import { viewFor } from './views';

const event = (id: EventId) => ({ kind: 'event', event: id }) as const;
const play = (id: EventId, extra: object = {}) =>
  ({ type: 'play-event', event: id, ...extra }) as PandemicMove;

/** A 3-player game, p1 to move; `holder` holds `id`. */
function holding(id: EventId, holder: SeatId = 'p2'): GameState {
  const game = blankGame(3);
  give(game, holder, event(id));
  return game;
}

const reason = (game: GameState, seat: SeatId, move: PandemicMove) => {
  const check = checkMove(game, seat, move);
  return check.ok ? 'ok' : check.reason;
};

describe('when an event card may be played', () => {
  it('from any seat holding it, on its turn or not, and it is not an action', () => {
    const game = holding('one-quiet-night', 'p2');
    expect(game.turn.seat).toBe('p1');
    expect(canPlayEvent(game, 'p2')).toBe(true);
    expect(canPlayEvent(game, 'p1')).toBe(false);
    const next = applyMove(game, 'p2', play('one-quiet-night'));
    expect(next.turn.actionsLeft).toBe(game.turn.actionsLeft);
    expect(next.turn.seat).toBe('p1');
  });

  it('puts the card on the player discard pile and writes it in the log', () => {
    const game = holding('government-grant');
    const next = applyMove(game, 'p2', play('government-grant', { city: 'tokyo' }));
    expect(next.hands.p2).toEqual([]);
    expect(next.playerDiscard).toEqual([event('government-grant')]);
    expect(next.log.current.entries).toContainEqual({
      type: 'event',
      seat: 'p2',
      event: 'government-grant',
      stored: false,
      city: 'tokyo',
    });
  });

  it('is refused for a card the seat does not hold', () => {
    const game = holding('airlift', 'p2');
    expect(reason(game, 'p3', play('airlift', { pawn: 'p3', to: 'paris' }))).toBe('card-missing');
    expect(reason(game, 'p2', play('one-quiet-night'))).toBe('card-missing');
  });

  it('is refused once the game is over', () => {
    const game = holding('one-quiet-night');
    game.status = 'won';
    expect(reason(game, 'p2', play('one-quiet-night'))).toBe('game-over');
  });

  it('is refused while an offer waits for its answer', () => {
    const game = holding('one-quiet-night', 'p3');
    give(game, 'p1', city('atlanta'));
    game.pawns.p2 = 'atlanta';
    const offered = applyShare(game, 'p1', {
      type: 'share-offer',
      direction: 'give',
      with: 'p2',
      city: 'atlanta',
    });
    expect(reason(offered, 'p3', play('one-quiet-night'))).toBe('answer-first');
  });

  it('is refused between drawing an epidemic and resolving it, except Resilient Population in its pause', () => {
    const game = holding('one-quiet-night', 'p2');
    give(game, 'p3', event('resilient-population'));
    game.infectionDiscard = ['paris'];
    game.turn.step = 'epidemic';
    game.turn.epidemics = 1;
    game.turn.epidemicStep = 'increase';
    expect(reason(game, 'p2', play('one-quiet-night'))).toBe('card-resolving');
    game.turn.epidemicStep = 'infect';
    expect(reason(game, 'p2', play('one-quiet-night'))).toBe('card-resolving');
    expect(canPlayCard(game, 'p3', 'resilient-population')).toBe(false);
    // The pause: after the Infect step, before Intensify.
    game.turn.epidemicStep = 'intensify';
    expect(reason(game, 'p2', play('one-quiet-night'))).toBe('card-resolving');
    expect(canPlayCard(game, 'p2', 'one-quiet-night')).toBe(false);
    expect(reason(game, 'p3', play('resilient-population', { city: 'paris' }))).toBe('ok');
  });

  it('is allowed again between two epidemics drawn together', () => {
    const game = holding('one-quiet-night', 'p2');
    game.turn.step = 'epidemic';
    game.turn.epidemics = 2;
    game.turn.epidemicStep = 'increase';
    expect(canPlayEvent(game, 'p2')).toBe(false);
    // The first epidemic resolves: its Intensify step is the last move.
    game.turn.epidemicStep = 'intensify';
    game.infectionDeck = ['paris', 'london'];
    const after = applyTurnMove(game, 'p1', { type: 'epidemic' });
    expect(after.turn.epidemics).toBe(1);
    expect(after.turn.epidemicStep).toBe('increase');
    expect(canPlayEvent(after, 'p2')).toBe(true);
  });

  it('can be played between infection cards', () => {
    const game = holding('one-quiet-night', 'p2');
    game.turn.step = 'infect';
    game.turn.infectionsLeft = 2;
    expect(canPlayEvent(game, 'p2')).toBe(true);
  });

  it('is checked the same way from a view: the client asks the same question', () => {
    const game = holding('one-quiet-night', 'p2');
    const view = viewFor(game, 'p2');
    expect(canActInView(view, 'p2', play('one-quiet-night'))).toBe(true);
    expect(canActInView(view, 'p3', play('one-quiet-night'))).toBe(false);
  });
});

describe('Airlift', () => {
  it('moves your own pawn at once, with no action spent', () => {
    const game = holding('airlift', 'p2');
    const next = applyMove(game, 'p2', play('airlift', { pawn: 'p2', to: 'tokyo' }));
    expect(next.pawns.p2).toBe('tokyo');
    expect(next.pending).toBeNull();
    expect(next.turn.actionsLeft).toBe(game.turn.actionsLeft);
  });

  it("is an offer on someone else's pawn: the card stays until its owner accepts", () => {
    const game = holding('airlift', 'p2');
    const offered = applyMove(game, 'p2', play('airlift', { pawn: 'p3', to: 'tokyo' }));
    expect(offered.pending).toMatchObject({ kind: 'move', by: 'p2', pawn: 'p3' });
    expect(offered.hands.p2).toEqual([event('airlift')]);
    expect(offered.pawns.p3).toBe('atlanta');

    const accepted = applyMoveOffer(offered, 'p3', { type: 'move-accept' });
    expect(accepted.pawns.p3).toBe('tokyo');
    expect(accepted.hands.p2).toEqual([]);
    expect(accepted.playerDiscard).toEqual([event('airlift')]);
    expect(accepted.turn.actionsLeft).toBe(game.turn.actionsLeft);
    expect(accepted.pending).toBeNull();
  });

  it('keeps the card when the offer is declined or canceled', () => {
    const offered = applyMove(
      holding('airlift'),
      'p2',
      play('airlift', { pawn: 'p3', to: 'tokyo' }),
    );
    for (const [seat, type] of [
      ['p3', 'move-decline'],
      ['p2', 'move-cancel'],
    ] as const) {
      const done = applyMoveOffer(offered, seat, { type });
      expect(done.hands.p2).toEqual([event('airlift')]);
      expect(done.pawns.p3).toBe('atlanta');
      expect(done.pending).toBeNull();
    }
  });

  it('is answered by the pawn owner only, and needs the card still held', () => {
    const offered = applyMove(
      holding('airlift'),
      'p2',
      play('airlift', { pawn: 'p3', to: 'tokyo' }),
    );
    expect(checkMoveOffer(offered, 'p2', { type: 'move-accept' })).toEqual({
      ok: false,
      reason: 'not-your-answer',
    });
    const lost = structuredClone(offered);
    lost.hands.p2 = [];
    expect(checkMoveOffer(lost, 'p3', { type: 'move-accept' }).ok).toBe(false);
  });

  it('refuses the city the pawn is in, and a pawn that is not in the game', () => {
    const game = holding('airlift');
    expect(reason(game, 'p2', play('airlift', { pawn: 'p3', to: 'atlanta' }))).toBe('same-city');
    expect(reason(game, 'p2', play('airlift', { pawn: 'p4', to: 'tokyo' }))).toBe('bad-partner');
  });

  it('lets the pawn arrive with its role (the Medic clears a cured disease)', () => {
    const game = holding('airlift', 'p2');
    game.roles.p2 = 'medic';
    game.cures.blue = 'cured';
    addCubes(game, 'chicago', 'blue', 2);
    const next = applyMove(game, 'p2', play('airlift', { pawn: 'p2', to: 'chicago' }));
    expect(next.cubes.chicago.blue).toBe(0);
  });
});

describe('Government Grant', () => {
  it('builds a station in any city, with no card', () => {
    const next = applyMove(
      holding('government-grant'),
      'p2',
      play('government-grant', { city: 'tokyo' }),
    );
    expect(next.stations).toContain('tokyo');
  });

  it('refuses a city that has a station already', () => {
    const game = holding('government-grant');
    game.stations = ['atlanta'];
    expect(reason(game, 'p2', play('government-grant', { city: 'atlanta' }))).toBe(
      'station-exists',
    );
  });

  it('needs a station to move once all 6 are built, like Build', () => {
    const game = holding('government-grant');
    game.stations = ['atlanta', 'paris', 'london', 'essen', 'milan', 'chicago'];
    expect(game.stations).toHaveLength(MAX_STATIONS);
    expect(reason(game, 'p2', play('government-grant', { city: 'tokyo' }))).toBe(
      'bad-station-to-move',
    );
    expect(reason(game, 'p2', play('government-grant', { city: 'tokyo', move: 'tokyo' }))).toBe(
      'bad-station-to-move',
    );
    const next = applyMove(game, 'p2', play('government-grant', { city: 'tokyo', move: 'paris' }));
    expect(next.stations).toHaveLength(MAX_STATIONS);
    expect(next.stations).toContain('tokyo');
    expect(next.stations).not.toContain('paris');
  });

  it('refuses a station to move while there is room', () => {
    const game = holding('government-grant');
    game.stations = ['atlanta'];
    expect(reason(game, 'p2', play('government-grant', { city: 'tokyo', move: 'atlanta' }))).toBe(
      'bad-station-to-move',
    );
  });
});

describe('One Quiet Night', () => {
  it('skips the next infect step: the turn ends with no city infected', () => {
    const game = holding('one-quiet-night');
    const quiet = applyMove(game, 'p2', play('one-quiet-night'));
    expect(quiet.quietNight).toBe(true);

    quiet.turn.step = 'draw';
    quiet.turn.actionsLeft = 0;
    quiet.playerDeck = [city('paris'), city('london')];
    const before = structuredClone(quiet.infectionDeck);
    const done = applyTurnMove(quiet, 'p1', { type: 'draw' });
    expect(done.turn.seat).toBe('p2');
    expect(done.turn.step).toBe('actions');
    expect(done.quietNight).toBe(false);
    expect(done.infectionDeck).toEqual(before);
    expect(done.infectionDiscard).toEqual([]);
    // The log of the finished turn says so.
    expect(done.log.previous?.entries).toContainEqual({ type: 'quiet-night' });
  });

  it("played during an infect step, it skips the next turn's, not the rest of this one", () => {
    const game = holding('one-quiet-night');
    game.turn.step = 'infect';
    game.turn.infectionsLeft = 2;
    game.infectionDeck = ['paris', 'london', 'essen'];
    const quiet = applyMove(game, 'p2', play('one-quiet-night'));
    const flipped = applyTurnMove(quiet, 'p1', { type: 'infect' });
    expect(flipped.infectionDiscard).toEqual(['paris']);
    expect(flipped.turn.infectionsLeft).toBe(1);
    expect(flipped.quietNight).toBe(true);
  });

  it('does not stop an epidemic from infecting', () => {
    const game = holding('one-quiet-night');
    const quiet = applyMove(game, 'p2', play('one-quiet-night'));
    quiet.turn.step = 'epidemic';
    quiet.turn.epidemics = 1;
    quiet.turn.epidemicStep = 'infect';
    quiet.infectionDeck = ['paris', 'london'];
    const done = applyTurnMove(quiet, 'p1', { type: 'epidemic' });
    const cubes = Object.values(done.cubes.london).reduce((sum, n) => sum + n, 0);
    expect(cubes).toBe(3);
  });
});

describe('Resilient Population', () => {
  it('removes a card of the infection discard pile from the game', () => {
    const game = holding('resilient-population');
    game.infectionDiscard = ['paris', 'london'];
    const next = applyMove(game, 'p2', play('resilient-population', { city: 'paris' }));
    expect(next.infectionDiscard).toEqual(['london']);
    // Out of the game, not back in the deck.
    expect(next.infectionDeck).toEqual(game.infectionDeck);
  });

  it('refuses a card that is not in the discard pile', () => {
    const game = holding('resilient-population');
    game.infectionDiscard = ['london'];
    expect(reason(game, 'p2', play('resilient-population', { city: 'paris' }))).toBe(
      'card-missing',
    );
  });

  it("in an epidemic's pause keeps the city just infected out of the reshuffle", () => {
    const game = holding('resilient-population', 'p3');
    game.turn.step = 'epidemic';
    game.turn.epidemics = 1;
    game.turn.epidemicStep = 'infect';
    game.infectionDeck = ['paris', 'london', 'essen'];
    const infected = applyTurnMove(game, 'p1', { type: 'epidemic' });
    expect(infected.infectionDiscard).toEqual(['essen']);
    expect(infected.turn.epidemicStep).toBe('intensify');

    const played = applyMove(infected, 'p3', play('resilient-population', { city: 'essen' }));
    const done = applyTurnMove(played, 'p1', { type: 'epidemic' });
    expect(done.infectionDeck).not.toContain('essen');
    expect(done.infectionDiscard).toEqual([]);
  });
});

describe('Forecast', () => {
  const deck = ['tokyo', 'osaka', 'seoul', 'paris', 'london', 'essen', 'milan', 'madrid'] as const;
  const forecast = (): GameState => {
    const game = holding('forecast', 'p2');
    game.infectionDeck = [...deck];
    return game;
  };

  it('takes the top 6 infection cards, for its player alone', () => {
    const next = applyMove(forecast(), 'p2', play('forecast'));
    expect(next.pending).toEqual({
      kind: 'forecast',
      seat: 'p2',
      count: 6,
      cards: deck.slice(0, 6),
    });
    expect(next.infectionDeck).toEqual(['milan', 'madrid']);

    expect(viewFor(next, 'p2').pending).toMatchObject({
      kind: 'forecast',
      cards: deck.slice(0, 6),
    });
    for (const viewer of ['p1', 'p3', 'spectator']) {
      expect(viewFor(next, viewer).pending).toEqual({
        kind: 'forecast',
        seat: 'p2',
        count: 6,
        cards: [],
      });
      expect(JSON.stringify(viewFor(next, viewer).pending)).not.toContain('osaka');
    }
  });

  it('shows what is left when fewer than 6 remain, and does nothing when the deck is empty', () => {
    const few = forecast();
    few.infectionDeck = ['tokyo', 'osaka'];
    expect(applyMove(few, 'p2', play('forecast')).pending).toMatchObject({ count: 2 });
    const none = forecast();
    none.infectionDeck = [];
    expect(applyMove(none, 'p2', play('forecast')).pending).toBeNull();
  });

  it('puts the cards back on top in the chosen order', () => {
    const next = applyMove(forecast(), 'p2', play('forecast'));
    const order = ['seoul', 'tokyo', 'osaka', 'london', 'paris', 'essen'] as const;
    const done = applyMove(next, 'p2', { type: 'forecast-order', cards: [...order] });
    expect(done.infectionDeck).toEqual([...order, 'milan', 'madrid']);
    expect(done.pending).toBeNull();
  });

  it('refuses any other set of cards, and any other seat', () => {
    const next = applyMove(forecast(), 'p2', play('forecast'));
    const cards = [...deck.slice(0, 6)];
    expect(reason(next, 'p2', { type: 'forecast-order', cards: cards.slice(1) })).toBe('bad-order');
    expect(
      reason(next, 'p2', { type: 'forecast-order', cards: [...cards.slice(1), 'milan'] }),
    ).toBe('bad-order');
    // A card twice, another missing.
    const twice = [cards[1], cards[1], cards[2], cards[3], cards[4], cards[5]] as never;
    expect(reason(next, 'p2', { type: 'forecast-order', cards: twice })).toBe('bad-order');
    expect(reason(next, 'p3', { type: 'forecast-order', cards })).toBe('not-your-answer');
    expect(reason(forecast(), 'p2', { type: 'forecast-order', cards })).toBe('no-forecast');
  });

  it('lets nothing else happen until the order is sent', () => {
    const next = applyMove(forecast(), 'p2', play('forecast'));
    give(next, 'p3', event('one-quiet-night'));
    expect(reason(next, 'p3', play('one-quiet-night'))).toBe('answer-first');
    expect(reason(next, 'p1', { type: 'pass' })).toBe('answer-first');
    expect(reason(next, 'p1', { type: 'drive', to: 'chicago' })).toBe('answer-first');
    next.turn.step = 'infect';
    expect(reason(next, 'p1', { type: 'infect' })).toBe('answer-first');
  });

  it('is refused while a hand-limit discard is owed', () => {
    const game = forecast();
    game.pending = { kind: 'discard', seat: 'p2' };
    expect(canPlayCard(game, 'p2', 'forecast')).toBe(false);
    expect(reason(game, 'p2', play('forecast'))).toBe('answer-first');
  });
});

describe('events and the hand limit', () => {
  /** p2 gets an 8th card by a share and must discard, or play an event. */
  function overLimit(): GameState {
    const game = blankGame(3);
    give(game, 'p1', city('atlanta'));
    for (const c of ['paris', 'london', 'essen', 'milan', 'madrid', 'moscow'] as const) {
      give(game, 'p2', city(c));
    }
    give(game, 'p2', event('one-quiet-night'));
    game.pawns.p2 = 'atlanta';
    const offered = applyShare(game, 'p1', {
      type: 'share-offer',
      direction: 'give',
      with: 'p2',
      city: 'atlanta',
    });
    return applyShare(offered, 'p2', { type: 'share-accept' });
  }

  it('lets the player over the limit play an event instead of discarding', () => {
    const game = overLimit();
    expect(game.hands.p2).toHaveLength(8);
    expect(game.pending).toEqual({ kind: 'discard', seat: 'p2' });
    const next = applyMove(game, 'p2', play('one-quiet-night'));
    expect(next.hands.p2).toHaveLength(7);
    expect(next.pending).toBeNull();
  });

  it('keeps the discard owed while the hand is still over the limit', () => {
    const game = overLimit();
    give(game, 'p2', city('sydney'));
    const next = applyMove(game, 'p2', play('one-quiet-night'));
    expect(next.hands.p2).toHaveLength(8);
    expect(next.pending).toEqual({ kind: 'discard', seat: 'p2' });
  });

  it('lets nobody else play an event meanwhile', () => {
    const game = overLimit();
    give(game, 'p3', event('government-grant'));
    expect(reason(game, 'p3', play('government-grant', { city: 'tokyo' }))).toBe('answer-first');
    expect(reason(game, 'p2', play('one-quiet-night'))).toBe('ok');
  });
});

describe("the Contingency Planner's stored event", () => {
  function planner(): GameState {
    const game = blankGame(3);
    game.roles.p2 = 'contingency-planner';
    game.contingency = 'one-quiet-night';
    return game;
  }

  it('is played from the role card at any allowed moment, then leaves the game', () => {
    const game = planner();
    expect(heldEvents(game, 'p2')).toEqual(['one-quiet-night']);
    expect(canPlayCard(game, 'p2', 'one-quiet-night')).toBe(true);
    const next = applyMove(game, 'p2', play('one-quiet-night'));
    expect(next.contingency).toBeNull();
    expect(next.playerDiscard).toEqual([]);
    expect(next.quietNight).toBe(true);
    expect(next.log.current.entries).toContainEqual(
      expect.objectContaining({ type: 'event', seat: 'p2', stored: true }),
    );
  });

  it('is not held by another role', () => {
    const game = planner();
    expect(heldEvents(game, 'p1')).toEqual([]);
    expect(reason(game, 'p1', play('one-quiet-night'))).toBe('card-missing');
  });

  it('does not count in the hand limit, and does not relieve a discard owed', () => {
    const game = planner();
    game.hands.p2 = [
      'paris',
      'london',
      'essen',
      'milan',
      'madrid',
      'moscow',
      'sydney',
      'tokyo',
    ].map((c) => city(c as never));
    game.pending = { kind: 'discard', seat: 'p2' };
    const next = applyMove(game, 'p2', play('one-quiet-night'));
    expect(next.contingency).toBeNull();
    expect(next.pending).toEqual({ kind: 'discard', seat: 'p2' });
  });

  it('can take an event from the discard pile and play it later', () => {
    const game = blankGame(3);
    game.roles.p1 = 'contingency-planner';
    game.playerDiscard = [event('airlift')];
    const taken = applyMove(game, 'p1', { type: 'take-event', event: 'airlift' });
    expect(taken.contingency).toBe('airlift');
    const done = applyMove(taken, 'p1', play('airlift', { pawn: 'p1', to: 'tokyo' }));
    expect(done.pawns.p1).toBe('tokyo');
    expect(done.contingency).toBeNull();
    expect(done.playerDiscard).toEqual([]);
  });
});

describe('the move schema and the definition', () => {
  const parses = (move: unknown) => pandemicMoveSchema.safeParse(move).success;

  it('accepts each event with its choices and refuses a missing or unknown one', () => {
    expect(parses(play('airlift', { pawn: 'p2', to: 'paris' }))).toBe(true);
    expect(parses(play('forecast'))).toBe(true);
    expect(parses(play('government-grant', { city: 'tokyo' }))).toBe(true);
    expect(parses(play('government-grant', { city: 'tokyo', move: 'paris' }))).toBe(true);
    expect(parses(play('one-quiet-night'))).toBe(true);
    expect(parses(play('resilient-population', { city: 'paris' }))).toBe(true);
    expect(parses({ type: 'forecast-order', cards: ['paris', 'london'] })).toBe(true);
    expect(parses(play('airlift', { to: 'paris' }))).toBe(false);
    expect(parses(play('government-grant'))).toBe(false);
    expect(parses({ type: 'play-event', event: 'nope' })).toBe(false);
    expect(parses({ type: 'forecast-order', cards: Array(7).fill('paris') })).toBe(false);
  });

  it('allows an event from a seat that is not an actor, and asks a Forecast answer of its player', () => {
    const game = holding('one-quiet-night', 'p2');
    expect(pandemic.actors(game)).toEqual([{ seat: 'p1', kind: 'turn' }]);
    expect(pandemic.validate(game, play('one-quiet-night'), { by: 'p2', at: 0 })).toEqual({
      ok: true,
    });
    const forecast = holding('forecast', 'p2');
    forecast.infectionDeck = ['paris', 'london'];
    const arranging = pandemic.apply(forecast, play('forecast'), { by: 'p2', at: 0 }) as GameState;
    expect(pandemic.actors(arranging)).toEqual([
      { seat: 'p2', kind: 'prompt', prompt: 'forecast' },
    ]);
  });
});

describe('random games', () => {
  it('play every event card, out of turn too, and stay legal', () => {
    const played = new Set<string>();
    let outOfTurn = 0;
    for (let seed = 1; seed <= 30; seed++) {
      let game = createGame({ seats: ['p1', 'p2', 'p3'], epidemics: 4, seed });
      for (let step = 0; step < 1500 && game.status === 'playing'; step++) {
        const { by, move } = agentMove(
          game,
          (() => {
            let n = step * 7919 + seed;
            return () => (n = (n * 1103515245 + 12345) % 2147483648) / 2147483648;
          })(),
        );
        const seat = by as SeatId;
        const next = move as PandemicMove;
        expect(checkMove(game, seat, next).ok).toBe(true);
        if (next.type === 'play-event') {
          played.add(next.event);
          if (seat !== game.turn.seat) outOfTurn += 1;
        }
        game = applyMove(game, seat, next);
      }
    }
    expect([...played].sort()).toEqual([
      'airlift',
      'forecast',
      'government-grant',
      'one-quiet-night',
      'resilient-population',
    ]);
    expect(outOfTurn).toBeGreaterThan(0);
  });
});
