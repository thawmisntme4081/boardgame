import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatClock } from '@/lib/clock';
import { NEXT_TURN_PAUSE_MS, useGame } from '@/store';
import { makeView, presence, resetStore } from '@/test/fixtures';
import { RoundCountdown } from './RoundCountdown';
import { StatusBar } from './StatusBar';

vi.mock('@/api', () => ({ ready: vi.fn(), leaveGame: vi.fn() }));

const T0 = new Date('2026-09-29T12:00:00Z').getTime();

beforeEach(() => {
  resetStore();
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

describe('formatClock', () => {
  it('shows m:ss, rounding up and never below 0:00', () => {
    expect(formatClock(180_000)).toBe('3:00');
    expect(formatClock(95_000)).toBe('1:35');
    expect(formatClock(9_001)).toBe('0:10');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-500)).toBe('0:00');
  });
});

describe('round countdown', () => {
  it('turns the time left in a view into a deadline on this device', () => {
    useGame.getState().setView({ ...makeView('pilot'), timerMs: 180_000, roundTimeLeftMs: 95_000 });
    expect(useGame.getState().roundDeadline).toBe(T0 + 95_000);
    useGame.getState().setView(makeView('pilot'));
    expect(useGame.getState().roundDeadline).toBeNull();
  });

  it('counts down and turns red for the last 30 seconds', () => {
    useGame.setState({ roundDeadline: T0 + 95_000 });
    render(<RoundCountdown />);
    const timer = screen.getByRole('timer');
    expect(timer).toHaveTextContent('1:35');
    expect(timer).not.toHaveClass('bg-danger');

    act(() => vi.advanceTimersByTime(70_000));
    expect(timer).toHaveTextContent('0:25');
    expect(timer).toHaveClass('bg-danger');

    act(() => vi.advanceTimersByTime(60_000));
    expect(timer).toHaveTextContent('0:00');
  });

  it('shows nothing without a running countdown', () => {
    render(<RoundCountdown />);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('sits next to the turn label while dice are being placed', () => {
    useGame.setState({ roundDeadline: T0 + 180_000 });
    const { rerender } = render(
      <StatusBar view={makeView('pilot')} presence={presence()} connection="online" />,
    );
    const turn = screen.getByText('Your turn');
    const timer = screen.getByRole('timer', { name: 'Time left this round: 3:00' });
    expect(turn.parentElement).toBe(timer.parentElement);

    rerender(
      <StatusBar
        view={makeView('pilot', { rolled: false })}
        presence={presence()}
        connection="online"
      />,
    );
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });
});

describe('next turn pause', () => {
  const placing = makeView('pilot');
  const nextRound = { ...makeView('pilot', { rolled: false }), round: 2 };

  it('starts a 5 s pause when a round ends and the game goes on', () => {
    useGame.getState().setView(placing);
    useGame.getState().setView(nextRound);
    expect(useGame.getState().nextTurnAt).toBe(T0 + NEXT_TURN_PAUSE_MS);
  });

  it('never pauses on the first view, at game over, or once dice are rolled', () => {
    useGame.getState().setView(nextRound); // first view: no previous round to finish
    expect(useGame.getState().nextTurnAt).toBeNull();
    useGame.getState().setView(placing);
    useGame.getState().setView({ ...placing, round: 2, phase: 'lost', endReason: 'spin' });
    expect(useGame.getState().nextTurnAt).toBeNull();
    useGame.getState().setView(placing);
    useGame.getState().setView(nextRound);
    useGame.getState().setView({ ...placing, round: 2 }); // both ready early
    expect(useGame.getState().nextTurnAt).toBeNull();
  });

  it('counts down in green next to the turn label, then disappears', () => {
    useGame.setState({ nextTurnAt: T0 + NEXT_TURN_PAUSE_MS });
    render(<StatusBar view={nextRound} presence={presence()} connection="online" />);
    const pause = screen.getByRole('timer', { name: 'Next turn in 5 seconds' });
    expect(pause).toHaveTextContent('Next turn in 5s');
    expect(pause).toHaveClass('bg-light-on');
    expect(pause.parentElement).toBe(screen.getByText('Strategy: talk it over').parentElement);

    act(() => vi.advanceTimersByTime(2_100));
    expect(pause).toHaveTextContent('Next turn in 3s');
    act(() => vi.advanceTimersByTime(3_000));
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });
});
