import type { Crew, Presence } from '@sky/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogScenario, crew, makeView, presence, resetStore } from '@/test/fixtures';
import { DiceTray } from './tray/DiceTray';
import { Preflight } from './Preflight';

vi.mock('@/api', () => ({
  pickAbility: vi.fn(async () => true),
  chooseSeat: vi.fn(async () => true),
  confirmSetup: vi.fn(async () => true),
}));
const api = await import('@/api');

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

/** Ana (pilot) created the game; Ben is the co-pilot. */
const setup = (): Presence => {
  const p = presence();
  return { pilot: { ...p.pilot!, creator: true }, copilot: p.copilot };
};

/** Before round 1, with the seats chosen unless `choices` says otherwise. */
const before = (seat: 'pilot' | 'copilot', scenario?: string, choices: Partial<Crew> = {}) =>
  makeView(seat, { rolled: false, scenario, patch: { phase: 'setup', crew: crew(choices) } });

describe('Preflight', () => {
  const two = () => catalogScenario((s) => s.abilities === 2);
  const one = () => catalogScenario((s) => s.abilities === 1);

  it('lets the creator choose the seats; the partner only sees them', async () => {
    render(
      <Preflight view={before('pilot', undefined, { rolesChosen: false })} presence={setup()} />,
    );
    const pilot = screen.getByRole('button', { name: 'Pilot' });
    expect(pilot).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Co-pilot' }));
    expect(api.chooseSeat).toHaveBeenCalledWith('copilot');
  });

  it('shows the partner their own seat once chosen, without letting them change it', () => {
    render(<Preflight view={before('copilot')} presence={setup()} />);
    expect(screen.getByText('Ana chooses the seats.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Co-pilot' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Pilot' })).toBeDisabled();
  });

  it('lets each player pick a card when there are two, but not the partner’s', async () => {
    render(
      <Preflight
        view={before('copilot', two().id, { picks: { pilot: 'control', copilot: null } })}
        presence={setup()}
      />,
    );
    expect(screen.getByText('Special Abilities: each of you picks one card.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Control/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /^Mastery/ }));
    expect(api.pickAbility).toHaveBeenCalledWith('mastery');
  });

  it('leaves a single card to the creator', () => {
    render(<Preflight view={before('copilot', one().id)} presence={setup()} />);
    expect(screen.getByText('Special Ability: Ana picks the card.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Mastery/ })).toBeDisabled();
  });

  it('confirms once seats and cards are chosen, then waits for the partner', async () => {
    const { rerender } = render(<Preflight view={before('pilot', two().id)} presence={setup()} />);
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    expect(screen.getByText('Choose the Special Abilities.')).toBeInTheDocument();

    const picked = (confirmed = false) =>
      makeView('pilot', {
        rolled: false,
        scenario: two().id,
        abilities: ['control', 'mastery'],
        patch: {
          phase: 'setup',
          crew: crew({
            picks: { pilot: 'control', copilot: 'mastery' },
            confirmed: { pilot: confirmed, copilot: false },
          }),
        },
      });
    rerender(<Preflight view={picked()} presence={setup()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(api.confirmSetup).toHaveBeenCalled();
    rerender(<Preflight view={picked(true)} presence={setup()} />);
    expect(screen.getByText('Waiting for Ben to confirm.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });

  it('disappears once round 1 starts, and the tray points to it until then', () => {
    const { unmount } = render(<DiceTray view={before('pilot')} presence={setup()} />);
    expect(screen.getByText(/^Choose the seats and Special Abilities above/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Roll dice' })).not.toBeInTheDocument();
    unmount();
    render(<Preflight view={makeView('pilot', { rolled: false })} presence={setup()} />);
    expect(screen.queryByRole('region', { name: 'Before take-off' })).not.toBeInTheDocument();
  });
});
