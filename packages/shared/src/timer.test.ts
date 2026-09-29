import { describe, expect, it } from 'vitest';
import { expireRoundTimer, placeDie, rollDice, roundTimeLeft, startRoundTimer } from './rules';
import { YUL } from './scenarios';
import { createGame, ROUND_TIMER_MS } from './state';
import { QUIET_DICE, QUIET_ROUND, play, setupRound } from './test-utils';
import { viewFor } from './views';

const T0 = 1_000_000;

describe('round timer', () => {
  it('is off unless asked for; the default length is 3 minutes', () => {
    expect(createGame(YUL, 1)).toMatchObject({ timerMs: null, deadline: null });
    expect(createGame(YUL, 1, { timerMs: ROUND_TIMER_MS })).toMatchObject({
      timerMs: 180_000,
      deadline: null,
    });
  });

  it('starts when the dice are rolled in a timed game', () => {
    const rolled = rollDice(createGame(YUL, 1, { timerMs: 60_000 }));
    expect(startRoundTimer(rolled, T0).deadline).toBe(T0 + 60_000);
    expect(roundTimeLeft(startRoundTimer(rolled, T0), T0 + 15_000)).toBe(45_000);
  });

  it('never starts in an untimed game or outside the placing phase', () => {
    const untimed = rollDice(createGame(YUL, 1));
    expect(startRoundTimer(untimed, T0)).toBe(untimed);
    const strategy = createGame(YUL, 1, { timerMs: 60_000 });
    expect(startRoundTimer(strategy, T0)).toBe(strategy);
    expect(roundTimeLeft(strategy, T0)).toBeNull();
  });

  it('loses the game when time runs out, and not a moment before', () => {
    const running = startRoundTimer(rollDice(createGame(YUL, 1, { timerMs: 60_000 })), T0);
    expect(expireRoundTimer(running, T0 + 59_999)).toBe(running);
    const lost = expireRoundTimer(running, T0 + 60_000);
    expect(lost).toMatchObject({
      phase: 'lost',
      endReason: 'time-up',
      deadline: null,
      currentSeat: null,
    });
    expect(lost.log.at(-1)).toEqual({
      type: 'game-end',
      round: 1,
      result: 'lost',
      reason: 'time-up',
    });
    expect(roundTimeLeft(running, T0 + 90_000)).toBe(0);
  });

  it('stops when the last die of the round is placed', () => {
    const s = play(
      setupRound({ ...QUIET_DICE, patch: { timerMs: 60_000, deadline: T0 + 60_000 } }),
      QUIET_ROUND,
    );
    expect(s).toMatchObject({ phase: 'strategy', round: 2, deadline: null, timerMs: 60_000 });
    expect(expireRoundTimer(s, T0 + 999_999)).toBe(s);
  });

  it('stops when the game ends during the round', () => {
    const s = placeDie(
      placeDie(
        setupRound({
          pilot: [6, 3],
          copilot: [3, 3],
          patch: { timerMs: 60_000, deadline: T0 + 60_000 },
        }),
        'pilot',
        { dieId: 'p1', slot: 'axisPilot', coffeeDelta: 0 },
      ),
      'copilot',
      { dieId: 'c1', slot: 'axisCopilot', coffeeDelta: 0 },
    );
    expect(s).toMatchObject({ phase: 'lost', endReason: 'spin', deadline: null });
  });

  it('shows players the time left, not the server clock', () => {
    const running = startRoundTimer(rollDice(createGame(YUL, 1, { timerMs: 60_000 })), T0);
    const view = viewFor(running, 'pilot', T0 + 20_000);
    expect(view).toMatchObject({ timerMs: 60_000, roundTimeLeftMs: 40_000 });
    expect(JSON.stringify(view)).not.toContain('deadline');
    expect(viewFor(createGame(YUL, 1), 'pilot', T0)).toMatchObject({
      timerMs: null,
      roundTimeLeftMs: null,
    });
  });
});
