import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DIFFICULTY_NAMES } from '@sky/shared';
import { scenarioSummary } from '@/lib/setup';
import { codeFromPath } from '@/session';
import { catalogScenario } from '@/test/fixtures';
import { Lobby, WaitingRoom } from './Lobby';

vi.mock('@/api', () => ({
  createRoom: vi.fn(async () => true),
  joinRoom: vi.fn(async () => true),
  leaveGame: vi.fn(),
  shareInvite: vi.fn(async () => {}),
}));
const api = await import('@/api');

beforeEach(() => vi.clearAllMocks());
afterEach(() => window.history.replaceState(null, '', '/'));

describe('Lobby', () => {
  it('creates a game with the trimmed name', async () => {
    render(<Lobby />);
    const create = screen.getByRole('button', { name: 'Create a game' });
    expect(create).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Your name'), '  Ana ');
    await userEvent.click(create);
    expect(api.createRoom).toHaveBeenCalledWith('Ana', false, {
      scenario: 'yul-green',
      abilities: [],
    });
  });

  it('offers a round timer, off by default', async () => {
    render(<Lobby />);
    const timer = screen.getByRole('switch', { name: /Round timer/ });
    expect(timer).not.toBeChecked();
    expect(screen.getByText(/3:00 to place all the dice each round/)).toBeInTheDocument();
    await userEvent.click(timer);
    expect(timer).toBeChecked();
    await userEvent.type(screen.getByLabelText('Your name'), 'Ana');
    await userEvent.click(screen.getByRole('button', { name: 'Create a game' }));
    expect(api.createRoom).toHaveBeenCalledWith('Ana', true, {
      scenario: 'yul-green',
      abilities: [],
    });
  });

  it('picks a scenario, then exactly as many special abilities as it allows', async () => {
    const two = catalogScenario((s) => s.abilities === 2);
    render(<Lobby />);
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('YUL');
    expect(screen.queryByText(/Choose .* special/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox', { name: 'Scenario' }));
    await userEvent.click(
      screen.getByRole('option', { name: `${two.name}, ${DIFFICULTY_NAMES[two.difficulty]}` }),
    );
    expect(screen.getByText(scenarioSummary(two))).toBeInTheDocument();
    expect(screen.getByText('Choose 2 special abilities')).toBeInTheDocument();
    const pressed = () =>
      screen.getAllByRole('button', { pressed: true }).map((b) => b.textContent);
    expect(pressed()).toEqual(['Adaptation', 'Anticipation']);
    // A third choice drops the oldest.
    await userEvent.click(screen.getByRole('button', { name: 'Control' }));
    expect(pressed()).toEqual(['Anticipation', 'Control']);

    await userEvent.type(screen.getByLabelText('Your name'), 'Ana');
    await userEvent.click(screen.getByRole('button', { name: 'Create a game' }));
    expect(api.createRoom).toHaveBeenCalledWith('Ana', false, {
      scenario: two.id,
      abilities: ['anticipation', 'control'],
    });
  });

  it('joins by code, uppercasing and dropping anything but letters', async () => {
    render(<Lobby />);
    await userEvent.type(screen.getByLabelText('Your name'), 'Ben');
    await userEvent.type(screen.getByLabelText('Game code'), 'ab-1cd');
    expect(screen.getByLabelText('Game code')).toHaveValue('ABCD');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(api.joinRoom).toHaveBeenCalledWith('ABCD', 'Ben');
  });

  it('prefills the code from an invite link and hides "create"', () => {
    window.history.replaceState(null, '', '/r/wxyz');
    render(<Lobby />);
    expect(screen.getByLabelText('Game code')).toHaveValue('WXYZ');
    expect(screen.queryByRole('button', { name: 'Create a game' })).not.toBeInTheDocument();
  });
});

describe('WaitingRoom', () => {
  it('shows the code and shares the invite', async () => {
    render(<WaitingRoom code="QRST" />);
    expect(screen.getByLabelText('Game code Q R S T')).toHaveTextContent('QRST');
    await userEvent.click(screen.getByRole('button', { name: 'Share invite' }));
    expect(api.shareInvite).toHaveBeenCalledWith('QRST');
  });
});

describe('WaitingRoom after a partner left', () => {
  it('names the missing seat', () => {
    render(<WaitingRoom code="QRST" missing="pilot" timerMs={180_000} />);
    expect(screen.getByText('Waiting for your pilot')).toBeInTheDocument();
    expect(screen.getByText(/Timed game: 3:00 per round/)).toBeInTheDocument();
  });

  it('shows the scenario so whoever joins knows what they fly', () => {
    const scenario = catalogScenario((s) => s.modules.length > 0);
    render(<WaitingRoom code="QRST" scenario={scenario} />);
    expect(screen.getByText(scenario.name)).toBeInTheDocument();
    expect(screen.getByText(scenarioSummary(scenario))).toBeInTheDocument();
  });
});

describe('codeFromPath', () => {
  it('reads /r/ABCD links only', () => {
    expect(codeFromPath('/r/abcd')).toBe('ABCD');
    expect(codeFromPath('/r/ABCD/')).toBe('ABCD');
    expect(codeFromPath('/r/ABC')).toBe('');
    expect(codeFromPath('/')).toBe('');
  });
});
