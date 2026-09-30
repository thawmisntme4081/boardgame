import { describe, expect, it } from 'vitest';
import { canUseAbility, useAbility } from './abilities';
import { canPlaceDie, placeDie, rollDice, TRAFFIC_DIE } from './rules';
import { createGame } from './state';
import { QUIET_DICE, QUIET_ROUND, play, setupRound, testScenario } from './test-utils';
import type { AbilityAction, AbilityId, GameState, PlaceIntent, Seat, SlotId } from './types';
import { canUseAbilityInView, viewFor } from './views';

const intent = (dieId: string, slot: SlotId, coffeeDelta = 0): PlaceIntent => ({
  dieId,
  slot,
  coffeeDelta,
});

const placeReason = (s: GameState, seat: Seat, i: PlaceIntent) => {
  const check = canPlaceDie(s, seat, i);
  return check.ok ? 'ok' : check.reason;
};

const abilityReason = (s: GameState, seat: Seat, action: AbilityAction) => {
  const check = canUseAbility(s, seat, action);
  return check.ok ? 'ok' : check.reason;
};

const withAbility = (ability: AbilityId, dice = QUIET_DICE, patch: Partial<GameState> = {}) =>
  setupRound({ ...dice, abilities: [ability], patch });

describe('control', () => {
  it('earns a coffee for two equal Axis dice', () => {
    const moves = QUIET_ROUND.slice(0, 2);
    expect(play(withAbility('control'), moves).coffee).toBe(1);
    expect(play(setupRound(QUIET_DICE), moves).coffee).toBe(0);
  });
});

describe('mastery', () => {
  it('earns a reroll token for two equal Engine dice while one is left in the box', () => {
    const moves = QUIET_ROUND.slice(0, 4);
    // 3 tokens: 1 in the supply, 1 waiting at 2000, so 1 in the box.
    expect(play(withAbility('mastery'), moves).rerolls).toBe(2);
    expect(play(withAbility('mastery', QUIET_DICE, { rerolls: 2 }), moves).rerolls).toBe(2);
    expect(play(setupRound(QUIET_DICE), moves).rerolls).toBe(1);
  });
});

describe('synchronisation', () => {
  const synced = () =>
    play(withAbility('synchronisation'), [
      ['pilot', 'p1', 'gear1'],
      ['copilot', 'c1', 'flaps1'],
    ]);

  it('rolls the traffic die once dice are on both Landing Gear and Flaps', () => {
    const s = synced();
    expect(s.bonus).not.toBeNull();
    expect(TRAFFIC_DIE).toContain(s.bonus!.die.value);
    expect(s.currentSeat).toBe('copilot');
    expect(s.log.at(-1)).toMatchObject({ type: 'bonus-die' });
    expect(
      play(setupRound(QUIET_DICE), [
        ['pilot', 'p1', 'gear1'],
        ['copilot', 'c1', 'flaps1'],
      ]).bonus,
    ).toBeNull();
  });

  it('the co-pilot places it on any colour, without coffee, before anything else', () => {
    const s = { ...synced(), coffee: 1 };
    const id = s.bonus!.die.id;
    expect(placeReason(s, 'pilot', intent(id, 'axisPilot'))).toBe('not-your-turn');
    expect(placeReason(s, 'copilot', intent('c2', 'axisCopilot'))).toBe('bonus-pending');
    expect(placeReason(s, 'copilot', intent(id, 'axisPilot', 1))).toBe('bad-coffee');
    const after = placeDie(s, 'copilot', intent(id, 'axisPilot'));
    expect(after.placed.axisPilot).toEqual({
      seat: 'copilot',
      dieId: id,
      value: s.bonus!.die.value,
      source: 'traffic',
    });
    expect(after.bonus).toBeNull();
    // An extra action: the co-pilot triggered it, so the pilot plays next.
    expect(after.currentSeat).toBe('pilot');
    expect(after.dice.copilot).toHaveLength(3);
  });

  it('happens once a round', () => {
    let s = synced();
    s = placeDie(s, 'copilot', intent(s.bonus!.die.id, 'concentration1'));
    s = play(s, [
      ['pilot', 'p3', 'gear2'],
      ['copilot', 'c3', 'flaps2'],
    ]);
    expect(s.bonus).toBeNull();
  });

  it('never goes on the side boards', () => {
    const s = play(
      setupRound({
        ...QUIET_DICE,
        abilities: ['synchronisation'],
        scenario: { modules: ['kerosene'] },
      }),
      [
        ['pilot', 'p1', 'gear1'],
        ['copilot', 'c1', 'flaps1'],
      ],
    );
    expect(placeReason(s, 'copilot', intent(s.bonus!.die.id, 'kerosene'))).toBe('slot-not-allowed');
  });
});

describe('adaptation', () => {
  it('turns one die to its opposite side, once per game for each player, at any time', () => {
    let s = withAbility('adaptation');
    s = useAbility(s, 'copilot', { ability: 'adaptation', dieId: 'c1' });
    expect(s.dice.copilot[0]!.value).toBe(5);
    expect(abilityReason(s, 'copilot', { ability: 'adaptation', dieId: 'c2' })).toBe(
      'ability-used',
    );
    s = useAbility(s, 'pilot', { ability: 'adaptation', dieId: 'p3' });
    expect(s.dice.pilot[2]!.value).toBe(4);
    expect(s.log.at(-1)).toMatchObject({ type: 'ability', ability: 'adaptation', value: 4 });
  });

  it('needs the card, the placing phase and your own die', () => {
    expect(
      abilityReason(setupRound(QUIET_DICE), 'pilot', { ability: 'adaptation', dieId: 'p1' }),
    ).toBe('ability-unavailable');
    const strategy = createGame(testScenario(), 1, { abilities: ['adaptation'] });
    expect(abilityReason(strategy, 'pilot', { ability: 'adaptation', dieId: 'p1' })).toBe(
      'not-placing',
    );
    expect(
      abilityReason(withAbility('adaptation'), 'pilot', { ability: 'adaptation', dieId: 'c1' }),
    ).toBe('unknown-die');
  });
});

describe('anticipation', () => {
  it('lets the first player reroll one die before their first die, once a round', () => {
    let s = withAbility('anticipation');
    expect(abilityReason(s, 'copilot', { ability: 'anticipation', dieId: 'c1' })).toBe(
      'not-first-player',
    );
    s = useAbility(s, 'pilot', { ability: 'anticipation', dieId: 'p1' });
    expect(s.abilityUse.anticipation).toBe(true);
    expect(s.log.at(-1)).toMatchObject({ type: 'ability', ability: 'anticipation', dieId: 'p1' });
    expect(abilityReason(s, 'pilot', { ability: 'anticipation', dieId: 'p2' })).toBe(
      'ability-used',
    );
  });

  it('is too late once the first player has placed a die; it comes back next round', () => {
    let s = withAbility('anticipation');
    s = placeDie(s, 'pilot', intent('p1', 'axisPilot'));
    expect(abilityReason(s, 'pilot', { ability: 'anticipation', dieId: 'p2' })).toBe(
      'first-die-placed',
    );
    s = rollDice(play(s, QUIET_ROUND.slice(1)));
    // Round 2: the co-pilot goes first.
    expect(
      abilityReason(s, 'copilot', { ability: 'anticipation', dieId: s.dice.copilot[0]!.id }),
    ).toBe('ok');
  });
});

describe('working together', () => {
  it('swaps a die of each player once a round; the partner must answer', () => {
    let s = withAbility('working-together', { pilot: [2, 2, 3, 3], copilot: [5, 2, 3, 3] });
    s = useAbility(s, 'pilot', { ability: 'working-together', dieId: 'p1' });
    expect(s.swap).toEqual({ seat: 'pilot', dieId: 'p1', value: 2 });
    expect(placeReason(s, 'pilot', intent('p2', 'axisPilot'))).toBe('swap-pending');
    expect(abilityReason(s, 'pilot', { ability: 'working-together', dieId: 'p2' })).toBe(
      'swap-pending',
    );
    s = useAbility(s, 'copilot', { ability: 'working-together', dieId: 'c1' });
    expect(s.swap).toBeNull();
    expect(s.dice.pilot[0]).toEqual({ id: 'p1', value: 5 });
    expect(s.dice.copilot[0]).toEqual({ id: 'c1', value: 2 });
    expect(abilityReason(s, 'copilot', { ability: 'working-together', dieId: 'c2' })).toBe(
      'ability-used',
    );
  });

  it('needs the partner to have a die', () => {
    const s = withAbility('working-together', { pilot: [2, 2], copilot: [] });
    expect(abilityReason(s, 'pilot', { ability: 'working-together', dieId: 'p1' })).toBe(
      'no-partner-dice',
    );
  });
});

describe('abilities in the player view', () => {
  it('gives the client the same answer as the server', () => {
    const s = setupRound({
      ...QUIET_DICE,
      abilities: ['adaptation', 'anticipation', 'working-together'],
    });
    const actions: [Seat, AbilityAction][] = [
      ['pilot', { ability: 'adaptation', dieId: 'p1' }],
      ['copilot', { ability: 'anticipation', dieId: 'c1' }],
      ['pilot', { ability: 'anticipation', dieId: 'p1' }],
      ['copilot', { ability: 'working-together', dieId: 'c2' }],
      ['pilot', { ability: 'working-together', dieId: 'c2' }],
    ];
    for (const [seat, action] of actions) {
      expect(canUseAbilityInView(viewFor(s, seat), action)).toEqual(canUseAbility(s, seat, action));
    }
  });

  it('shows the swapped die face up but still hides the partner hand', () => {
    const s = useAbility(withAbility('working-together'), 'pilot', {
      ability: 'working-together',
      dieId: 'p1',
    });
    const view = viewFor(s, 'copilot');
    expect(view.swap).toEqual({ seat: 'pilot', value: 2 });
    expect(JSON.stringify(view)).not.toContain('"p1"');
  });
});
