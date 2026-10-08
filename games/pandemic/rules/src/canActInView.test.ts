// The client highlights moves with `canActInView`, which must agree with the server's `validate`.
import { playRandomGame } from '@platform/engine/testing';
import { describe, expect, it } from 'vitest';
import { pandemic } from './definition';
import { CITIES, COLORS } from './cities';
import { candidateActions } from './legal';
import { canActInView, type PandemicMove } from './moves';
import { agentMove } from './random-play';
import { SEATS, type GameState } from './types';
import { viewFor } from './views';

/** Many moves, legal or not, for one seat in one state. */
function candidates(state: GameState, seat: (typeof SEATS)[number]): PandemicMove[] {
  const hand = state.hands[seat] ?? [];
  return [
    ...candidateActions(state, seat),
    ...state.seats.flatMap((other) => [
      { type: 'share-offer', direction: 'give', with: other } as const,
      { type: 'share-offer', direction: 'take', with: other } as const,
    ]),
    { type: 'share-accept' },
    { type: 'share-decline' },
    { type: 'share-cancel' },
    { type: 'draw' },
    { type: 'epidemic' },
    { type: 'infect' },
    ...hand.map((card) => ({ type: 'discard', card }) as const),
    { type: 'discard', card: { kind: 'city', city: CITIES[0]!.id } },
    ...COLORS.map((color): PandemicMove => ({ type: 'cure', color, cards: [] })),
  ];
}

describe('canActInView', () => {
  it('agrees with validate for every seat on the states of random games', () => {
    let compared = 0;
    for (const players of [2, 3, 4]) {
      for (let seed = 1; seed <= 4; seed++) {
        const seats = SEATS.slice(0, players);
        const visited: GameState[] = [];
        playRandomGame({
          definition: pandemic,
          config: { players, epidemics: 4 },
          seats,
          seed,
          nextMove(state, random) {
            visited.push(state);
            return agentMove(state, random);
          },
          maxSteps: 3000,
        });
        // Every 7th state keeps the run fast and still spans whole games.
        for (const state of visited.filter((_, i) => i % 7 === 0)) {
          for (const seat of seats) {
            const view = viewFor(state, seat);
            for (const move of candidates(state, seat)) {
              const server = pandemic.validate(state, move, { by: seat, at: 0 }).ok;
              expect(canActInView(view, seat, move), JSON.stringify(move)).toBe(server);
              compared += 1;
            }
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(1000);
  });
});
