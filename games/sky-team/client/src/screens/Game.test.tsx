import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSkyTeam } from '../store';
import { makeView, presence, resetStore } from '../test/fixtures';
import Game from './Game';

vi.mock('../api', () => ({
  placeSelected: vi.fn(async () => true),
  ready: vi.fn(async () => true),
  reroll: vi.fn(async () => true),
  spendReroll: vi.fn(async () => true),
  rematch: vi.fn(async () => true),
  playAbility: vi.fn(async () => true),
  leaveGame: vi.fn(),
}));

beforeEach(resetStore);

/** Round 2 has just started: round 1 ended with the pilot's 4 on the axis. */
const nextRound = () =>
  makeView('pilot', {
    rolled: false,
    patch: {
      round: 2,
      currentSeat: 'copilot',
      lastRound: { placed: { axisPilot: { seat: 'pilot', dieId: 'r1-p1', value: 4 } }, speed: 7 },
    },
  });

describe('the pause after a round’s last die', () => {
  it('keeps the finished round’s dice on the board while "Next turn in 5s" runs', () => {
    useSkyTeam.setState({ nextTurnAt: Date.now() + 5_000 });
    render(<Game view={nextRound()} presence={presence()} connection="online" />);
    expect(screen.getByRole('button', { name: 'Axis 1 (pilot): 4' })).toBeInTheDocument();
  });

  it('clears the board once the pause is over', async () => {
    useSkyTeam.setState({ nextTurnAt: Date.now() - 1 });
    render(<Game view={nextRound()} presence={presence()} connection="online" />);
    expect(await screen.findByRole('button', { name: 'Axis 1 (pilot)' })).toBeInTheDocument();
  });

  it('shows the live board when there is no pause', () => {
    render(<Game view={nextRound()} presence={presence()} connection="online" />);
    expect(screen.getByRole('button', { name: 'Axis 1 (pilot)' })).toBeInTheDocument();
  });
});
