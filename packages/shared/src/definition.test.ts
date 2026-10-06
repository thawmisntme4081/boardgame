import type { PlayedMove } from '@platform/engine/testing';
import { checkGame } from '@platform/engine/testing';
import { describe, expect, it } from 'vitest';
import { ABILITY_IDS } from './abilities';
import { skyTeam, type SkyTeamMove } from './definition';
import { createRandomAgent, type AgentAction } from './random-play';
import { otherSeat } from './rules';
import { SCENARIO_LIST, YUL } from './scenarios';
import type { GameState } from './types';
import type { PlayerView } from './views';

const NOW = 1_000_000;
const TIMER_MS = 60_000;

function toMove(action: AgentAction, now: number): PlayedMove<SkyTeamMove> {
  switch (action.type) {
    case 'roll':
      return { by: 'system', move: { type: 'roll', at: now } };
    case 'spend-reroll':
      return { by: action.seat, move: { type: 'spend-reroll' } };
    case 'reroll':
      return { by: action.seat, move: { type: 'reroll', dieIds: action.dieIds } };
    case 'place':
      return { by: action.seat, move: { type: 'place', ...action.intent } };
    case 'ability':
      return { by: action.seat, move: { type: 'ability', ...action.action } };
  }
}

/** The random agent from `random-play`, plus the system's moves: begin, and now and then a timer that runs out. */
function randomMoves(seed: number) {
  const agent = createRandomAgent(seed);
  return (state: GameState, random: () => number): PlayedMove<SkyTeamMove> => {
    if (state.phase === 'setup') return { by: 'system', move: { type: 'begin' } };
    const [due] = skyTeam.schedule!(state);
    if (due && random() < 0.03) return { by: 'system', move: due.move };
    return toMove(agent(state), NOW);
  };
}

/** The partner's dice values, the RNG and the move log never reach a view. */
function findLeaks(state: GameState, view: PlayerView, viewer: string): string[] {
  const json = JSON.stringify(view);
  const partner = state.dice[otherSeat(viewer as 'pilot' | 'copilot')];
  return [
    ...partner.filter((d) => json.includes(`"${d.id}"`)).map((d) => `partner die ${d.id}`),
    ...['rngState', 'rngSeed', '"log"'].filter((key) => json.includes(key)),
  ];
}

const options = (seed: number, config: object) => ({
  definition: skyTeam,
  config,
  seats: skyTeam.meta.seats,
  seed,
  now: NOW,
  nextMove: randomMoves(seed),
  findLeaks,
});

describe('skyTeam definition', () => {
  it('plays every scenario through the engine kit: schemas, plain data, no leaks, replay', () => {
    for (const scenario of SCENARIO_LIST) {
      for (const seed of [1, 2]) {
        const abilities = ABILITY_IDS.slice(seed, seed + scenario.abilities);
        const played = checkGame(options(seed, { scenario: scenario.id, abilities }));
        expect(played.outcome.kind).toBe('coop');
      }
    }
  }, 120_000);

  it('runs timed games, where the scheduled time-up ends them or the round', () => {
    for (const seed of [3, 4, 5]) {
      checkGame(options(seed, { scenario: YUL.id, timerMs: TIMER_MS }));
    }
  });

  it('rejects bad setups and malformed moves', () => {
    expect(skyTeam.configSchema.safeParse({ scenario: 'nowhere' }).success).toBe(false);
    expect(skyTeam.configSchema.safeParse({ scenario: YUL.id, abilities: ['x'] }).success).toBe(
      false,
    );
    expect(skyTeam.moveSchema.safeParse({ type: 'place', dieId: 'a' }).success).toBe(false);
    expect(skyTeam.moveSchema.safeParse({ type: 'teleport' }).success).toBe(false);
  });

  it('keeps system moves for the system and seat moves for the seats', () => {
    const state = skyTeam.setup({
      config: skyTeam.configSchema.parse({ scenario: YUL.id }),
      seats: skyTeam.meta.seats,
      seed: 1,
    });
    expect(skyTeam.validate(state, { type: 'begin' }, 'pilot')).toEqual({
      ok: false,
      reason: 'not-allowed',
    });
    const started = skyTeam.apply(state, { type: 'begin' }, 'system');
    expect(skyTeam.validate(started, { type: 'spend-reroll' }, 'system').ok).toBe(false);
    expect(skyTeam.validate(started, { type: 'spend-reroll' }, 'spectator').ok).toBe(false);
    expect(() => skyTeam.apply(started, { type: 'begin' }, 'system')).toThrow('not-setup');
    const rolled = skyTeam.apply(started, { type: 'roll', at: NOW }, 'system');
    expect(skyTeam.actors(rolled)).toEqual([{ seat: rolled.currentSeat, kind: 'turn' }]);
    expect(skyTeam.outcome(rolled)).toBeNull();
  });
});
