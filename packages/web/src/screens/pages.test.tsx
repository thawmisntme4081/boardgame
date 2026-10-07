import { createGame, DIFFICULTY_NAMES, SCENARIO_LIST, viewFor, YUL } from '@sky/rules';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlatform } from '../store';
import { loadGame } from '../games';
import { renderAt, resetStore } from '../test/fixtures';

vi.mock('../api', () => ({
  createRoom: vi.fn(async () => true),
  joinRoom: vi.fn(async () => true),
  leaveGame: vi.fn(),
  shareInvite: vi.fn(async () => {}),
  setNavigate: vi.fn(),
}));
const api = await import('../api');

// The game's module is a separate chunk: transformed once, up front (slow on a cold run).
beforeAll(() => loadGame('sky-team'), 60_000);

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

describe('the game picker', () => {
  it('lists Sky Team and opens its page', async () => {
    const { router } = await renderAt('/');
    const link = screen.getByRole('link', { name: /^Sky Team/ });
    expect(link).toHaveTextContent('Two players, cooperative');
    await userEvent.click(link);
    expect(router.state.location.pathname).toBe('/play/sky-team');
    expect(await screen.findByRole('button', { name: 'Create a game' })).toBeInTheDocument();
  });

  it('joins by code, uppercasing and dropping anything but letters', async () => {
    await renderAt('/');
    await userEvent.type(screen.getByLabelText('Your name'), 'Ben');
    await userEvent.type(screen.getByLabelText('Game code'), 'ab-1cd');
    expect(screen.getByLabelText('Game code')).toHaveValue('ABCD');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(api.joinRoom).toHaveBeenCalledWith('ABCD', 'Ben');
  });

  it('takes a player who holds a seat back to their room', async () => {
    usePlatform.setState({
      session: { code: 'QRST', game: 'sky-team', token: 't', seat: 'pilot', name: 'Ana' },
    });
    const { router } = await renderAt('/');
    expect(router.state.location.pathname).toBe('/r/QRST');
  });
});

describe("a game's page", () => {
  it('creates a game with the trimmed name and the default setup', async () => {
    await renderAt('/play/sky-team');
    const create = await screen.findByRole('button', { name: 'Create a game' });
    expect(create).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Your name'), '  Ana ');
    await userEvent.click(create);
    expect(api.createRoom).toHaveBeenCalledWith('Ana', 'sky-team', {
      scenario: 'yul-green',
      timer: false,
    });
  });

  it("passes the game's own options: the round timer and the scenario", async () => {
    const two = SCENARIO_LIST.find((s) => s.abilities === 2)!;
    await renderAt('/play/sky-team');
    const timer = await screen.findByRole('switch', { name: /Round timer/ });
    expect(timer).not.toBeChecked();
    await userEvent.click(timer);
    await userEvent.click(screen.getByRole('combobox', { name: 'Scenario' }));
    await userEvent.click(
      screen.getByRole('option', { name: `${two.name}, ${DIFFICULTY_NAMES[two.difficulty]}` }),
    );
    await userEvent.type(screen.getByLabelText('Your name'), 'Ana');
    await userEvent.click(screen.getByRole('button', { name: 'Create a game' }));
    expect(api.createRoom).toHaveBeenCalledWith('Ana', 'sky-team', {
      scenario: two.id,
      timer: true,
    });
  });
});

describe('a room', () => {
  it('opens an invite link on the join form, with the code and no "create"', async () => {
    await renderAt('/r/wxyz');
    expect(screen.getByLabelText('Game code')).toHaveValue('WXYZ');
    expect(screen.queryByRole('button', { name: 'Create a game' })).not.toBeInTheDocument();
  });

  it('waits for the empty seat: the code, the invite, and what the game says', async () => {
    usePlatform.setState({
      session: { code: 'QRST', game: 'sky-team', token: 't', seat: 'pilot', name: 'Ana' },
      match: {
        matchId: 'QRST-1-a',
        version: 0,
        seat: 'pilot',
        view: viewFor(createGame(YUL, 1, { setup: true }), 'pilot'),
      },
      presence: { pilot: { name: 'Ana', online: true, creator: true }, copilot: null },
    });
    await renderAt('/r/QRST');
    expect(await screen.findByText('Waiting for your co-pilot')).toBeInTheDocument();
    expect(screen.getByText(YUL.name)).toBeInTheDocument();
    expect(screen.getByLabelText('Game code Q R S T')).toHaveTextContent('QRST');
    await userEvent.click(screen.getByRole('button', { name: 'Share invite' }));
    expect(api.shareInvite).toHaveBeenCalledWith('QRST');
  });
});

describe('the history page', () => {
  it("shows a signed-in player's Flight Log, one section per game", async () => {
    usePlatform.setState({
      account: {
        methods: { google: false, email: true },
        user: { id: 'u1', name: 'Ana', email: 'ana@example.com', image: null },
      },
    });
    await renderAt('/history');
    expect(screen.getByRole('heading', { name: 'My history' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Sky Team' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument();
  });

  it('asks a signed-out visitor to sign in instead', async () => {
    usePlatform.setState({
      account: { methods: { google: false, email: true }, user: null },
    });
    await renderAt('/history');
    expect(screen.getByText(/Sign in to see your history/)).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'History' })).toBeNull();
  });
});
