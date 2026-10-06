import type { MoveContext } from '@platform/engine';
import { checkGame, type NextMove } from '@platform/engine/testing';
import { describe, expect, it } from 'vitest';
import { ABILITY_IDS } from './abilities';
import { skyTeam, type SkyTeamMove } from './definition';
import { createRandomAgent, type AgentAction } from './random-play';
import { otherSeat } from './rules';
import { SCENARIO_LIST, YUL } from './scenarios';
import { SEATS, type GameState, type Seat } from './types';
import type { PlayerView } from './views';

const NOW = 1_000_000;
const TIMER_MS = 60_000;

function toMove(action: AgentAction): NextMove<SkyTeamMove> {
  switch (action.type) {
    case 'roll':
      throw new Error('the strategy phase is handled before the agent');
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

/** Before round 1: the host chooses the seats, the cards are picked, both confirm. */
function setupMove(state: GameState, random: () => number): NextMove<SkyTeamMove> {
  const { crew, scenario } = state;
  if (!crew.rolesChosen) {
    const seat: Seat = random() < 0.5 ? 'pilot' : 'copilot';
    return { by: 'system', move: { type: 'table:choose-seat', seat } };
  }
  if (state.abilities.length < scenario.abilities) {
    const seat = scenario.abilities === 1 ? crew.host : SEATS.find((s) => !crew.picks[s])!;
    const free = ABILITY_IDS.filter((a) => a !== crew.picks[otherSeat(seat)]);
    const ability = free[Math.floor(random() * free.length)]!;
    return { by: seat, move: { type: 'pick-ability', ability } };
  }
  return { by: SEATS.find((s) => !crew.confirmed[s])!, move: { type: 'confirm' } };
}

/**
 * The random agent from `random-play` for the dice, plus everything around it: the setup,
 * "ready", and the platform's scheduled moves (Total Trust's roll always, a timer that runs
 * out now and then). The clock only moves forward: a scheduled move happens at its own time.
 */
function randomMoves(seed: number) {
  const agent = createRandomAgent(seed);
  let clock = NOW;
  return (state: GameState, random: () => number): NextMove<SkyTeamMove> => {
    if (state.phase === 'setup') return { ...setupMove(state, random), at: clock };
    const [due] = skyTeam.schedule!(state);
    if (due && (due.move.type === 'roll' || random() < 0.03)) {
      clock = Math.max(clock, due.at);
      return { by: 'system', move: due.move, at: clock };
    }
    if (state.phase === 'strategy') {
      const seat = SEATS.find((s) => !state.crew.ready[s])!;
      return { by: seat, move: { type: 'ready' }, at: clock };
    }
    return { ...toMove(agent(state)), at: clock };
  };
}

/** The partner's dice values, the RNG and the move log never reach a view. */
function findLeaks(state: GameState, view: PlayerView, viewer: string): string[] {
  const json = JSON.stringify(view);
  const partner = state.dice[otherSeat(viewer as Seat)];
  return [
    ...partner.filter((d) => json.includes(`"${d.id}"`)).map((d) => `partner die ${d.id}`),
    ...['rngState', 'rngSeed', '"log"', 'autoRollAt', 'deadline'].filter((key) =>
      json.includes(key),
    ),
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

const system = (at = NOW): MoveContext => ({ by: 'system', at });
const by = (seat: Seat, at = NOW): MoveContext => ({ by: seat, at });

function newGame(config: object = {}, seats: readonly Seat[] = SEATS) {
  return skyTeam.setup({
    config: skyTeam.configSchema.parse({ scenario: YUL.id, ...config }),
    seats,
    host: 'pilot',
    seed: 1,
  });
}

/** Applies moves one after another, each checked first. */
function play(
  state: GameState,
  ...moves: [SkyTeamMove | Parameters<typeof skyTeam.apply>[1], MoveContext][]
) {
  for (const [move, ctx] of moves) {
    const check = skyTeam.validate(state, move, ctx);
    if (!check.ok) throw new Error(`${JSON.stringify(move)}: ${check.reason}`);
    state = skyTeam.apply(state, move, ctx);
  }
  return state;
}

describe('skyTeam definition', () => {
  it('plays every scenario through the engine kit: schemas, plain data, no leaks, replay', () => {
    for (const scenario of SCENARIO_LIST) {
      for (const seed of [1, 2]) {
        const played = checkGame(options(seed, { scenario: scenario.id }));
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
    expect(skyTeam.configSchema.safeParse({ scenario: YUL.id, timerMs: -1 }).success).toBe(false);
    expect(skyTeam.moveSchema.safeParse({ type: 'place', dieId: 'a' }).success).toBe(false);
    expect(skyTeam.moveSchema.safeParse({ type: 'teleport' }).success).toBe(false);
    // Players cannot send the platform's moves.
    expect(skyTeam.moveSchema.safeParse({ type: 'roll' }).success).toBe(false);
    expect(skyTeam.moveSchema.safeParse({ type: 'table:join', seat: 'pilot' }).success).toBe(false);
  });

  it('keeps system moves for the system and seat moves for the seats', () => {
    const state = newGame();
    const choose = { type: 'table:choose-seat', seat: 'pilot' } as const;
    expect(skyTeam.validate(state, choose, by('pilot'))).toEqual({
      ok: false,
      reason: 'not-allowed',
    });
    expect(skyTeam.validate(state, { type: 'confirm' }, system()).ok).toBe(false);
    expect(skyTeam.validate(state, { type: 'confirm' }, { by: 'spectator', at: NOW }).ok).toBe(
      false,
    );
    expect(skyTeam.validate(state, { type: 'roll' }, system()).ok).toBe(false);
  });

  it('starts round 1 once the seats are chosen and both confirm; rolls once both are ready', () => {
    let state = newGame({ timerMs: TIMER_MS });
    expect(skyTeam.validate(state, { type: 'confirm' }, by('pilot'))).toEqual({
      ok: false,
      reason: 'roles-missing',
    });
    state = play(
      state,
      [{ type: 'table:choose-seat', seat: 'pilot' }, system()],
      [{ type: 'confirm' }, by('pilot')],
    );
    expect(skyTeam.actors(state)).toEqual([
      { seat: 'pilot', kind: 'simultaneous', committed: true },
      { seat: 'copilot', kind: 'simultaneous', committed: false },
    ]);
    state = play(state, [{ type: 'confirm' }, by('copilot')]);
    expect(state.phase).toBe('strategy');
    expect(state.crew.confirmed).toEqual({ pilot: false, copilot: false });

    state = play(state, [{ type: 'ready' }, by('copilot', NOW + 5)]);
    expect(state.phase).toBe('strategy');
    state = play(state, [{ type: 'ready' }, by('pilot', NOW + 10)]);
    expect(state).toMatchObject({ phase: 'placing', deadline: NOW + 10 + TIMER_MS });
    expect(state.crew.ready).toEqual({ pilot: false, copilot: false });
    expect(skyTeam.actors(state)).toEqual([{ seat: state.currentSeat, kind: 'turn' }]);
    expect(skyTeam.schedule!(state)).toEqual([
      { at: NOW + 10 + TIMER_MS, move: { type: 'time-up' } },
    ]);
    // Early, the time-up is refused; at the deadline the round is lost.
    expect(skyTeam.validate(state, { type: 'time-up' }, system(NOW + 11)).ok).toBe(false);
    const late = play(state, [{ type: 'time-up' }, system(NOW + 10 + TIMER_MS)]);
    expect(skyTeam.outcome(late)).toEqual({ kind: 'coop', won: false, reasons: ['time-up'] });
  });

  it('needs the partner at the table before confirming; a join seats them', () => {
    let state = newGame({}, ['pilot']);
    state = play(state, [{ type: 'table:choose-seat', seat: 'copilot' }, system()]);
    expect(state.crew).toMatchObject({ host: 'copilot', seated: { pilot: false, copilot: true } });
    expect(skyTeam.validate(state, { type: 'confirm' }, by('copilot'))).toEqual({
      ok: false,
      reason: 'no-partner',
    });
    state = play(state, [{ type: 'table:join', seat: 'pilot' }, system()]);
    expect(skyTeam.validate(state, { type: 'confirm' }, by('copilot')).ok).toBe(true);
  });

  it('lets each player pick their own card with two, only the host with one; picks follow seats', () => {
    const two = SCENARIO_LIST.find((s) => s.abilities === 2)!;
    let state = newGame({ scenario: two.id });
    state = play(state, [{ type: 'pick-ability', ability: 'control' }, by('pilot')]);
    expect(
      skyTeam.validate(state, { type: 'pick-ability', ability: 'control' }, by('copilot')),
    ).toEqual({ ok: false, reason: 'ability-taken' });
    state = play(
      state,
      [{ type: 'pick-ability', ability: 'mastery' }, by('copilot')],
      [{ type: 'table:choose-seat', seat: 'copilot' }, system()],
    );
    expect(state.crew.picks).toEqual({ pilot: 'mastery', copilot: 'control' });
    expect(state.crew.host).toBe('copilot');

    const one = SCENARIO_LIST.find((s) => s.abilities === 1)!;
    const single = newGame({ scenario: one.id });
    expect(
      skyTeam.validate(single, { type: 'pick-ability', ability: 'control' }, by('copilot')),
    ).toEqual({ ok: false, reason: 'not-your-pick' });
  });

  it('carries the picks into the next game, minus those of a player who left', () => {
    const two = SCENARIO_LIST.find((s) => s.abilities === 2)!;
    let state = newGame({ scenario: two.id });
    state = play(
      state,
      [{ type: 'table:choose-seat', seat: 'pilot' }, system()],
      [{ type: 'pick-ability', ability: 'control' }, by('pilot')],
      [{ type: 'pick-ability', ability: 'mastery' }, by('copilot')],
    );
    const config = skyTeam.configSchema.parse({ scenario: two.id });
    const rematch = skyTeam.setup({
      config,
      seats: SEATS,
      host: 'pilot',
      seed: 2,
      previous: state,
    });
    expect(rematch.abilities).toEqual(['control', 'mastery']);
    expect(rematch.crew.rolesChosen).toBe(true);
    const restart = skyTeam.setup({
      config,
      seats: ['copilot'],
      host: 'copilot',
      seed: 3,
      previous: state,
    });
    expect(restart.abilities).toEqual(['mastery']);
    expect(restart.crew).toMatchObject({ host: 'copilot', rolesChosen: false });
  });
});
