import { checkGame } from '@platform/engine/testing';
import { describe, expect, it } from 'vitest';
import { pandemic, type PandemicConfig } from './definition';
import { agentMove } from './random-play';
import { SEATS, type GameState } from './types';
import type { PandemicView } from './views';

const config = (players: number, epidemics: number): PandemicConfig => ({ players, epidemics });

function findLeaks(_state: GameState, view: PandemicView): string[] {
  const json = JSON.stringify(view);
  return ['"rngState"', '"rngSeed"', '"playerDeck"', '"infectionDeck"'].filter((key) =>
    json.includes(key),
  );
}

function run(players: number, epidemics: number, seed: number) {
  return checkGame({
    definition: pandemic,
    config: config(players, epidemics),
    seats: SEATS.slice(0, players),
    seed,
    nextMove: (state, random) => agentMove(state, random),
    findLeaks,
    maxSteps: 3000,
  });
}

describe('the engine test kit', () => {
  for (const players of [2, 3, 4]) {
    for (const epidemics of [4, 5, 6]) {
      it(`plays and replays games of ${players} players with ${epidemics} epidemics`, () => {
        for (let seed = 1; seed <= 10; seed++) {
          const { outcome } = run(players, epidemics, seed);
          expect(outcome.kind).toBe('coop');
        }
      });
    }
  }
});

describe('the definition', () => {
  const state = (): GameState =>
    pandemic.setup({ config: config(2, 4), seats: ['p1', 'p2'], host: 'p1', seed: 3 });

  it('describes a cooperative game for 2 to 4 players', () => {
    expect(pandemic.meta).toMatchObject({ minPlayers: 2, maxPlayers: 4, mode: 'coop' });
    expect(pandemic.id).toBe('pandemic');
  });

  it('checks the setup', () => {
    expect(pandemic.configSchema.parse({})).toEqual({ players: 2, epidemics: 4 });
    expect(pandemic.configSchema.safeParse({ epidemics: 3 }).success).toBe(false);
    expect(pandemic.configSchema.safeParse({ players: 5 }).success).toBe(false);
  });

  it('checks the shape of every move', () => {
    const ok = (move: unknown) => pandemic.moveSchema.safeParse(move).success;
    expect(ok({ type: 'drive', to: 'chicago' })).toBe(true);
    expect(ok({ type: 'drive', to: 'narnia' })).toBe(false);
    expect(ok({ type: 'treat', color: 'purple' })).toBe(false);
    expect(ok({ type: 'discard', card: { kind: 'event', event: 'airlift' } })).toBe(true);
    expect(ok({ type: 'share-offer', direction: 'give', with: 'p2' })).toBe(true);
    expect(ok({ type: 'nope' })).toBe(false);
  });

  it('names the active seat as the turn, and an owed answer as a prompt', () => {
    const game = state();
    expect(pandemic.actors(game)).toEqual([{ seat: game.turn.seat, kind: 'turn' }]);
    game.pending = { kind: 'discard', seat: 'p2' };
    expect(pandemic.actors(game)).toEqual([{ seat: 'p2', kind: 'prompt', prompt: 'discard' }]);
    game.pending = { kind: 'share', from: 'p1', to: 'p2', city: 'atlanta' };
    const answerer = pandemic.actors(game)[0]!;
    expect(answerer.kind).toBe('prompt');
    expect(answerer.seat).not.toBe(game.turn.seat);
    game.status = 'won';
    expect(pandemic.actors(game)).toEqual([]);
  });

  it('refuses a move from a seat that is not at the table, or from the system', () => {
    const game = state();
    const system = { by: 'system', at: 0 } as const;
    expect(pandemic.validate(game, { type: 'pass' }, { by: 'p3', at: 0 })).toEqual({
      ok: false,
      reason: 'not-seated',
    });
    expect(pandemic.validate(game, { type: 'pass' }, system).ok).toBe(false);
    expect(pandemic.validate(game, { type: 'table:choose-seat', seat: 'p1' }, system).ok).toBe(
      false,
    );
  });

  it('accepts a seat joining without changing the game', () => {
    const game = state();
    const ctx = { by: 'system', at: 0 } as const;
    expect(pandemic.validate(game, { type: 'table:join', seat: 'p2' }, ctx).ok).toBe(true);
    expect(pandemic.apply(game, { type: 'table:join', seat: 'p2' }, ctx)).toEqual(game);
  });

  it('throws when an invalid move is applied', () => {
    const game = state();
    const other = game.seats.find((seat) => seat !== game.turn.seat)!;
    expect(() => pandemic.apply(game, { type: 'pass' }, { by: other, at: 0 })).toThrow();
  });

  it('has an outcome only when the game is over', () => {
    const game = state();
    expect(pandemic.outcome(game)).toBeNull();
    game.status = 'lost';
    game.lossReason = 'cubes';
    expect(pandemic.outcome(game)).toEqual({ kind: 'coop', won: false, reasons: ['cubes'] });
  });
});
