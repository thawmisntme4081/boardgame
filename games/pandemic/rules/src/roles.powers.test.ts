// Each role's own power, in isolation: the core rules never check for a role by name, so each
// test only sets the role on a seat and watches the shared checks and actions react to it.
import { describe, expect, it } from 'vitest';
import { applyAction, cardsToCure, checkAction, movePawn, type Action } from './actions';
import { applyMoveOffer, checkMoveOffer } from './moveOffer';
import { infectCity } from './outbreak';
import { applyRoleAction, checkRoleAction } from './roleActions';
import type { RoleAction } from './roles';
import { applyShare, checkShare } from './share';
import { addCubes, blankGame, city, give } from './test-utils';
import { CUBES_PER_COLOR } from './types';

describe('Scientist', () => {
  it('cures with 4 cards of a color instead of 5', () => {
    const game = blankGame();
    game.roles.p1 = 'scientist';
    game.stations = ['atlanta'];
    give(game, 'p1', city('chicago'), city('essen'), city('milan'), city('san-francisco'));
    // A blue cube stays on the map, so curing leaves it 'cured' rather than 'eradicated'.
    addCubes(game, 'washington', 'blue', 1);
    expect(cardsToCure(game, 'p1')).toBe(4);

    const cure: Action = {
      type: 'cure',
      color: 'blue',
      cards: ['chicago', 'essen', 'milan', 'san-francisco'],
    };
    expect(checkAction(game, 'p1', cure).ok).toBe(true);

    const next = applyAction(game, 'p1', cure);
    expect(next.cures.blue).toBe('cured');
    expect(next.hands.p1).toHaveLength(0);
  });

  it('still needs 5 cards for a non-Scientist', () => {
    const game = blankGame();
    game.stations = ['atlanta'];
    give(game, 'p1', city('chicago'), city('essen'), city('milan'), city('san-francisco'));
    expect(cardsToCure(game, 'p1')).toBe(5);
    const cure: Action = {
      type: 'cure',
      color: 'blue',
      cards: ['chicago', 'essen', 'milan', 'san-francisco'],
    };
    expect(checkAction(game, 'p1', cure)).toEqual({ ok: false, reason: 'bad-cards' });
  });
});

describe('Researcher', () => {
  it('gives any city card on their own turn, even one not of the shared city', () => {
    const game = blankGame();
    game.roles.p1 = 'researcher';
    game.pawns.p2 = 'atlanta';
    give(game, 'p1', city('tokyo'));
    const offer = { type: 'share-offer', direction: 'give', with: 'p2', city: 'tokyo' } as const;
    expect(checkShare(game, 'p1', offer).ok).toBe(true);

    const offered = applyShare(game, 'p1', offer);
    const done = applyShare(offered, 'p2', { type: 'share-accept' });
    expect(done.hands.p1).toHaveLength(0);
    expect(done.hands.p2?.[0]).toEqual(city('tokyo'));
  });

  it("cannot give another city's card without the role", () => {
    const game = blankGame();
    game.roles.p1 = 'medic';
    game.pawns.p2 = 'atlanta';
    give(game, 'p1', city('tokyo'));
    const offer = { type: 'share-offer', direction: 'give', with: 'p2', city: 'tokyo' } as const;
    expect(checkShare(game, 'p1', offer)).toEqual({ ok: false, reason: 'wrong-role' });
  });

  it('still needs the shared city to take a card from the Researcher', () => {
    const game = blankGame();
    game.roles.p1 = 'researcher';
    game.turn.seat = 'p2';
    game.pawns.p1 = 'atlanta';
    game.pawns.p2 = 'atlanta';
    give(game, 'p1', city('tokyo'));
    const take = { type: 'share-offer', direction: 'take', with: 'p1', city: 'tokyo' } as const;
    expect(checkShare(game, 'p2', take)).toEqual({ ok: false, reason: 'wrong-role' });
  });
});

describe('Operations Expert', () => {
  it('builds a research station without discarding a card', () => {
    const game = blankGame();
    game.roles.p1 = 'operations-expert';
    game.stations = [];
    const build: Action = { type: 'build' };
    expect(checkAction(game, 'p1', build).ok).toBe(true);
    const next = applyAction(game, 'p1', build);
    expect(next.stations).toContain('atlanta');
    expect(next.hands.p1).toHaveLength(0);
  });

  it('flies anywhere from a station by discarding any city card, once a turn', () => {
    const game = blankGame();
    game.roles.p1 = 'operations-expert';
    // Bangkok is a station too, so the Operations Expert is still at one after the flight.
    game.stations = ['atlanta', 'bangkok'];
    give(game, 'p1', city('tokyo'));
    const flight: RoleAction = { type: 'ops-flight', to: 'bangkok', card: 'tokyo' };
    expect(checkRoleAction(game, 'p1', flight).ok).toBe(true);

    const next = applyRoleAction(game, 'p1', flight);
    expect(next.pawns.p1).toBe('bangkok');
    expect(next.hands.p1).toHaveLength(0);
    expect(next.turn.actionsLeft).toBe(3);

    // A second flight the same turn is refused, even with another card.
    give(next, 'p1', city('miami'));
    const again: RoleAction = { type: 'ops-flight', to: 'atlanta', card: 'miami' };
    expect(checkRoleAction(next, 'p1', again)).toEqual({ ok: false, reason: 'power-used' });
  });

  it('refuses the flight away from a station', () => {
    const game = blankGame();
    game.roles.p1 = 'operations-expert';
    game.stations = [];
    give(game, 'p1', city('tokyo'));
    const flight: RoleAction = { type: 'ops-flight', to: 'bangkok', card: 'tokyo' };
    expect(checkRoleAction(game, 'p1', flight)).toEqual({ ok: false, reason: 'no-station' });
  });

  it('refuses the flight for a player without the role', () => {
    const game = blankGame();
    game.stations = ['atlanta'];
    give(game, 'p1', city('tokyo'));
    const flight: RoleAction = { type: 'ops-flight', to: 'bangkok', card: 'tokyo' };
    expect(checkRoleAction(game, 'p1', flight)).toEqual({ ok: false, reason: 'wrong-role' });
  });
});

describe('Quarantine Specialist', () => {
  it('blocks cubes on their own city and the cities connected to it', () => {
    const game = blankGame();
    game.roles.p1 = 'quarantine-specialist';
    game.pawns.p1 = 'atlanta';

    const onThem = infectCity(game, 'atlanta', 1);
    expect(onThem).toEqual({
      color: 'blue',
      cubes: 0,
      eradicated: false,
      prevented: true,
      outbreaks: [],
    });
    expect(game.cubes.atlanta.blue).toBe(0);

    const nextDoor = infectCity(game, 'chicago', 1);
    expect(nextDoor.prevented).toBe(true);
    expect(game.cubes.chicago.blue).toBe(0);
  });

  it('does not block a city it is not connected to', () => {
    const game = blankGame();
    game.roles.p1 = 'quarantine-specialist';
    game.pawns.p1 = 'atlanta';
    const far = infectCity(game, 'tokyo', 1);
    expect(far.prevented).toBe(false);
    expect(game.cubes.tokyo.red).toBe(1);
  });

  it('stops an outbreak from reaching or chaining through a protected city', () => {
    const game = blankGame();
    game.roles.p1 = 'quarantine-specialist';
    game.pawns.p1 = 'washington';
    // Chicago is full and not itself protected (only Washington and its own neighbors are); its
    // outbreak would chain into Atlanta, which is next to Washington and so takes nothing.
    addCubes(game, 'chicago', 'blue', 3);
    const result = infectCity(game, 'chicago', 1);
    expect(result.outbreaks).toEqual(['chicago']);
    expect(game.cubes.atlanta.blue).toBe(0);
    // A city not next to the Specialist still gets infected normally.
    expect(game.cubes['san-francisco'].blue).toBe(1);
  });
});

describe('Contingency Planner', () => {
  it('takes an event card from the discard pile onto the role card', () => {
    const game = blankGame();
    game.roles.p1 = 'contingency-planner';
    game.playerDiscard = [{ kind: 'event', event: 'airlift' }];
    const take: RoleAction = { type: 'take-event', event: 'airlift' };
    expect(checkRoleAction(game, 'p1', take).ok).toBe(true);

    const next = applyRoleAction(game, 'p1', take);
    expect(next.contingency).toBe('airlift');
    expect(next.playerDiscard).toHaveLength(0);
    expect(next.turn.actionsLeft).toBe(3);
  });

  it('cannot store a second event while one is already stored', () => {
    const game = blankGame();
    game.roles.p1 = 'contingency-planner';
    game.contingency = 'forecast';
    game.playerDiscard = [{ kind: 'event', event: 'airlift' }];
    const take: RoleAction = { type: 'take-event', event: 'airlift' };
    expect(checkRoleAction(game, 'p1', take)).toEqual({ ok: false, reason: 'event-stored' });
  });

  it('cannot take an event that is not in the discard pile', () => {
    const game = blankGame();
    game.roles.p1 = 'contingency-planner';
    const take: RoleAction = { type: 'take-event', event: 'airlift' };
    expect(checkRoleAction(game, 'p1', take)).toEqual({ ok: false, reason: 'no-event' });
  });
});

describe('Dispatcher', () => {
  it("moves another player's pawn only as an offer the owner answers", () => {
    const game = blankGame();
    game.roles.p1 = 'dispatcher';
    game.pawns.p2 = 'chicago';
    give(game, 'p1', city('miami'));
    const move: Action = { type: 'direct', to: 'miami', pawn: 'p2' };
    expect(checkAction(game, 'p1', move).ok).toBe(true);

    const offered = applyAction(game, 'p1', move);
    expect(offered.pending).toEqual({ kind: 'move', by: 'p1', pawn: 'p2', move });
    // Pawns and the hand do not change until the offer is accepted.
    expect(offered.pawns.p2).toBe('chicago');
    expect(offered.hands.p1).toHaveLength(1);

    const accepted = applyMoveOffer(offered, 'p2', { type: 'move-accept' });
    expect(accepted.pawns.p2).toBe('miami');
    expect(accepted.hands.p1).toHaveLength(0);
    expect(accepted.pending).toBeNull();
    expect(accepted.turn.actionsLeft).toBe(3);
  });

  it('lets the owner decline, and the Dispatcher cancel, with nothing spent', () => {
    const game = blankGame();
    game.roles.p1 = 'dispatcher';
    game.pawns.p2 = 'chicago';
    give(game, 'p1', city('miami'));
    const move: Action = { type: 'direct', to: 'miami', pawn: 'p2' };
    const offered = applyAction(game, 'p1', move);

    const declined = applyMoveOffer(offered, 'p2', { type: 'move-decline' });
    expect(declined.pawns.p2).toBe('chicago');
    expect(declined.pending).toBeNull();
    expect(declined.turn.actionsLeft).toBe(4);

    expect(checkMoveOffer(offered, 'p1', { type: 'move-cancel' }).ok).toBe(true);
    const cancelled = applyMoveOffer(offered, 'p1', { type: 'move-cancel' });
    expect(cancelled.pawns.p2).toBe('chicago');
    expect(cancelled.turn.actionsLeft).toBe(4);
  });

  it('refuses to move another pawn without the role', () => {
    const game = blankGame();
    game.pawns.p2 = 'chicago';
    give(game, 'p1', city('miami'));
    const move: Action = { type: 'direct', to: 'miami', pawn: 'p2' };
    expect(checkAction(game, 'p1', move)).toEqual({ ok: false, reason: 'wrong-role' });
  });

  it('can move any pawn to a city with another pawn, as `join`', () => {
    const game = blankGame();
    game.roles.p1 = 'dispatcher';
    game.pawns.p1 = 'atlanta';
    game.pawns.p2 = 'chicago';
    const join: Action = { type: 'join', to: 'chicago' };
    expect(checkAction(game, 'p1', join).ok).toBe(true);
    const next = applyAction(game, 'p1', join);
    expect(next.pawns.p1).toBe('chicago');
  });
});

describe('Medic', () => {
  it('treats all cubes of a color at once, not just one', () => {
    const game = blankGame();
    game.roles.p1 = 'medic';
    addCubes(game, 'atlanta', 'blue', 3);
    const treat: Action = { type: 'treat', color: 'blue' };
    const next = applyAction(game, 'p1', treat);
    expect(next.cubes.atlanta.blue).toBe(0);
    expect(next.supply.blue).toBe(CUBES_PER_COLOR);
  });

  it('clears a cured color from their city the moment they arrive, however they got there', () => {
    const game = blankGame();
    game.roles.p1 = 'medic';
    game.cures.blue = 'cured';
    addCubes(game, 'chicago', 'blue', 2);
    movePawn(game, 'p1', 'chicago');
    expect(game.cubes.chicago.blue).toBe(0);
    expect(game.supply.blue).toBe(CUBES_PER_COLOR);
  });

  it("clears their own city the instant any player discovers that color's cure", () => {
    const game = blankGame();
    game.roles.p1 = 'medic';
    game.pawns.p1 = 'atlanta';
    addCubes(game, 'atlanta', 'blue', 3);
    game.stations = ['chicago'];
    game.turn.seat = 'p2';
    game.pawns.p2 = 'chicago';
    game.roles.p2 = 'researcher';
    give(
      game,
      'p2',
      city('chicago'),
      city('essen'),
      city('milan'),
      city('san-francisco'),
      city('washington'),
    );
    const cure: Action = {
      type: 'cure',
      color: 'blue',
      cards: ['chicago', 'essen', 'milan', 'san-francisco', 'washington'],
    };
    expect(checkAction(game, 'p2', cure).ok).toBe(true);

    const next = applyAction(game, 'p2', cure);
    // The only blue cubes on the map were the Medic's own, cleared the instant blue is cured:
    // with none left anywhere, blue is eradicated outright.
    expect(next.cures.blue).toBe('eradicated');
    expect(next.cubes.atlanta.blue).toBe(0);
    expect(next.supply.blue).toBe(CUBES_PER_COLOR);
  });

  it('prevents a cured color from ever landing on their city', () => {
    const game = blankGame();
    game.roles.p1 = 'medic';
    game.pawns.p1 = 'atlanta';
    game.cures.blue = 'cured';
    const result = infectCity(game, 'atlanta', 1);
    expect(result.prevented).toBe(true);
    expect(game.cubes.atlanta.blue).toBe(0);
  });
});
