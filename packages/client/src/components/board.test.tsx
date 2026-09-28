import { canPlaceInView, SLOT_IDS } from '@sky/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGame } from '@/store';
import { makeView, presence, resetStore } from '@/test/fixtures';
import { Cockpit } from './Cockpit';
import { DiceTray } from './DiceTray';
import { GameOverDialog } from './GameOverDialog';
import { StatusBar } from './StatusBar';
import { ApproachTrack } from '@/svgs/ApproachTrack';

vi.mock('@/api', () => ({
  placeSelected: vi.fn(async () => true),
  ready: vi.fn(async () => true),
  reroll: vi.fn(async () => true),
  spendReroll: vi.fn(async () => true),
  rematch: vi.fn(async () => true),
  leaveGame: vi.fn(),
}));
const api = await import('@/api');

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

const validSlots = () =>
  [...document.querySelectorAll('button[data-valid]')].map((b) => b.getAttribute('aria-label'));

describe('Cockpit slots', () => {
  it('light up exactly the spaces the shared rules allow for the selected die', () => {
    const view = makeView('pilot', { pilot: [5, 1, 6, 2], patch: { coffee: 1 } });
    useGame.setState({ selectedDieId: 'p1', coffeeDelta: 0 });
    render(<Cockpit view={view} />);
    const expected = SLOT_IDS.filter(
      (slot) => canPlaceInView(view, { dieId: 'p1', slot, coffeeDelta: 0 }).ok,
    );
    expect(document.querySelectorAll('button[data-valid]')).toHaveLength(expected.length);
    expect(validSlots()).toContain('Landing gear 3 (pilot, needs 5 or 6)');
    expect(validSlots()).not.toContain('Landing gear 1 (pilot, needs 1 or 2)');
  });

  it('follows the draft coffee: a 5 with -1 fits the 3·4 gear', () => {
    const view = makeView('pilot', { pilot: [5, 1, 6, 2], patch: { coffee: 1 } });
    useGame.setState({ selectedDieId: 'p1', coffeeDelta: -1 });
    render(<Cockpit view={view} />);
    expect(validSlots()).toContain('Landing gear 2 (pilot, needs 3 or 4)');
    expect(validSlots()).not.toContain('Landing gear 3 (pilot, needs 5 or 6)');
  });

  it('lights nothing when it is not your turn', () => {
    useGame.setState({ selectedDieId: 'c1' });
    render(<Cockpit view={makeView('copilot')} />);
    expect(validSlots()).toEqual([]);
  });

  it('sends the move when a lit space is tapped', async () => {
    useGame.setState({ selectedDieId: 'p1' });
    render(<Cockpit view={makeView('pilot')} />);
    await userEvent.click(screen.getByRole('button', { name: 'Axis 1 (pilot)' }));
    expect(api.placeSelected).toHaveBeenCalledWith('axisPilot');
  });

  it('shows placed dice, deployed switches and coffee', () => {
    const view = makeView('copilot', {
      patch: {
        placed: { axisPilot: { seat: 'pilot', dieId: 'p1', value: 4 } },
        gear: [true, false, false],
        coffee: 2,
      },
    });
    render(<Cockpit view={view} />);
    expect(screen.getByRole('button', { name: 'Axis 1 (pilot): 4' })).toBeInTheDocument();
    const gear = screen.getByRole('region', { name: 'Landing gear' });
    expect(within(gear).getByRole('img', { name: 'Switch 1: deployed' })).toBeInTheDocument();
    expect(within(gear).getByRole('img', { name: 'Switch 2: not deployed' })).toBeInTheDocument();
    expect(screen.getByLabelText('2 coffee')).toBeInTheDocument();
  });
});

describe('DiceTray', () => {
  it('selects a die and offers coffee only when there is some', async () => {
    const { rerender } = render(<DiceTray view={makeView('pilot')} presence={presence()} />);
    expect(screen.getByText(/Your turn/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Your die: 3' }));
    expect(useGame.getState().selectedDieId).toBe('p2');
    expect(screen.queryByLabelText('Coffee')).not.toBeInTheDocument();

    rerender(<DiceTray view={makeView('pilot', { patch: { coffee: 1 } })} presence={presence()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Spend coffee: plus 1' }));
    expect(useGame.getState().coffeeDelta).toBe(1);
    // The selected 3 now shows 4 (the other 4 is not pressed).
    expect(screen.getByRole('button', { name: 'Your die: 4', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Spend coffee: plus 1' })).toBeDisabled();
  });

  it('says who is placing when it is the partner’s turn', () => {
    render(<DiceTray view={makeView('copilot')} presence={presence()} />);
    expect(screen.getByText('Ana is placing a die…')).toBeInTheDocument();
    expect(screen.getByLabelText('Ana has 4 dice left')).toBeInTheDocument();
  });

  it('explains the strategy phase without its own ready button', () => {
    render(
      <DiceTray view={makeView('pilot', { rolled: false })} presence={presence(false, true)} />,
    );
    expect(screen.getByText(/Talk strategy now/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('spends a reroll token, then rerolls the ticked dice', async () => {
    const { rerender } = render(<DiceTray view={makeView('pilot')} presence={presence()} />);
    await userEvent.click(screen.getByRole('button', { name: /Spend a reroll token/ }));
    expect(api.spendReroll).toHaveBeenCalled();

    const pending = makeView('pilot', {
      patch: { rerolls: 0, rerollPending: { pilot: true, copilot: true } },
    });
    rerender(<DiceTray view={pending} presence={presence()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Die 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Die 5' }));
    await userEvent.click(screen.getByRole('button', { name: /^Reroll 2/ }));
    expect(api.reroll).toHaveBeenCalledWith(['p1', 'p4']);
    await userEvent.click(screen.getByRole('button', { name: 'Keep all' }));
    expect(api.reroll).toHaveBeenLastCalledWith([]);
  });
});

describe('GameOverDialog', () => {
  it('lists every failed landing condition and offers a rematch', async () => {
    const view = makeView('pilot', {
      patch: {
        phase: 'lost',
        round: 7,
        endReason: 'landing-gear',
        landingFailures: ['landing-gear', 'landing-brakes'],
      },
    });
    render(<GameOverDialog view={view} />);
    const dialog = screen.getByRole('dialog', { name: 'The plane went down' });
    expect(within(dialog).getByText('Not all the landing gear was down.')).toBeInTheDocument();
    expect(within(dialog).getByText('Your speed was too high for the brakes.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Fly again' }));
    expect(api.rematch).toHaveBeenCalled();
  });

  it('celebrates a landing and stays closed during play', () => {
    const { rerender } = render(<GameOverDialog view={makeView('pilot')} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(<GameOverDialog view={makeView('pilot', { patch: { phase: 'won' } })} />);
    expect(screen.getByRole('dialog', { name: 'Smooth landing!' })).toBeInTheDocument();
  });
});

describe('ApproachTrack', () => {
  it('describes the planes ahead for screen readers', () => {
    render(<ApproachTrack view={makeView('pilot', { patch: { approachIndex: 2 } })} />);
    expect(
      screen.getByRole('img', {
        name: /4 spaces to the airport\. Planes per space from here: 1, 2, 1, 3, 2/,
      }),
    ).toBeInTheDocument();
  });
});

describe('StatusBar', () => {
  it('puts "Ready to roll" next to the strategy label', async () => {
    const view = makeView('pilot', { rolled: false });
    const { rerender } = render(
      <StatusBar view={view} presence={presence()} connection="online" />,
    );
    const label = screen.getByText('Strategy: talk it over');
    const button = screen.getByRole('button', { name: 'Ready to roll' });
    expect(label.parentElement).toBe(button.parentElement);
    await userEvent.click(button);
    expect(api.ready).toHaveBeenCalled();

    rerender(<StatusBar view={view} presence={presence(true, false)} connection="online" />);
    expect(screen.getByRole('button', { name: 'Waiting for Ben…' })).toBeDisabled();
  });

  it('hides the ready button once dice are rolled', () => {
    render(<StatusBar view={makeView('pilot')} presence={presence()} connection="online" />);
    expect(screen.getByText('Your turn')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ready to roll|Waiting/ })).not.toBeInTheDocument();
  });
});

describe('Leave game', () => {
  it('asks for confirmation before giving up the seat', async () => {
    render(<StatusBar view={makeView('pilot')} presence={presence()} connection="online" />);
    await userEvent.click(screen.getByRole('button', { name: 'Leave game' }));
    const dialog = screen.getByRole('dialog', { name: 'Leave this game?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
    expect(api.leaveGame).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Leave game' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Leave game' }),
    );
    expect(api.leaveGame).toHaveBeenCalled();
  });
});
