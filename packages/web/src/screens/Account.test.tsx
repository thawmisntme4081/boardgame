import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAccount, type AccountUser } from '../account';
import { loadGame } from '../games';
import { usePlatform } from '../store';
import { renderAt, resetStore } from '../test/fixtures';

vi.mock('../api', () => ({
  createRoom: vi.fn(async () => true),
  joinRoom: vi.fn(async () => true),
  leaveGame: vi.fn(),
  shareInvite: vi.fn(async () => {}),
  setNavigate: vi.fn(),
}));

beforeAll(() => loadGame('sky-team'), 60_000);

function fakeServer({ google = true, user = null as AccountUser | null } = {}) {
  const state = { user };
  const calls: string[] = [];
  const reply = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));
  vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
    calls.push(input);
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, string>) : {};
    switch (input) {
      case '/auth/methods':
        return reply({ google });
      case '/auth/me':
        return reply(state.user);
      case '/api/auth/sign-in/social':
        return reply({ url: 'https://accounts.google.com/' });
      case '/auth/name':
        state.user = { ...state.user!, name: body.name! };
        return reply(state.user);
      case '/api/auth/sign-out':
        state.user = null;
        return reply({ success: true });
      default:
        return reply({}, 404);
    }
  });
  return { state, calls };
}

beforeEach(() => resetStore());
afterEach(() => vi.unstubAllGlobals());

const ana: AccountUser = { id: 'u0', name: 'Ana', email: 'ana@example.com', image: null };

describe('signed out', () => {
  it('shows sign-in on the game picker and game page; the name stays editable', async () => {
    fakeServer();
    await loadAccount();
    const { router } = await renderAt('/');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your name')).not.toHaveAttribute('readonly');
    await router.navigate({ to: '/play/$gameId', params: { gameId: 'sky-team' } });
    expect(await screen.findByRole('button', { name: 'Create a game' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows only Google as the sign-in method', async () => {
    fakeServer();
    await loadAccount();
    await renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign in' });
    expect(within(dialog).getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Email')).toBeNull();
  });

  it('hides sign-in when Google is not configured or the server has no accounts', async () => {
    fakeServer({ google: false });
    await loadAccount();
    expect(usePlatform.getState().account).toBe('off');
    await renderAt('/');
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  });
});

describe('signed in', () => {
  it('shows the name and menu; signing out brings sign-in back', async () => {
    fakeServer({ user: ana });
    await loadAccount();
    await renderAt('/');
    expect(screen.getByLabelText('Your name')).toHaveValue('Ana');
    await userEvent.click(screen.getByRole('button', { name: 'Account: Ana' }));
    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Your name')).not.toHaveAttribute('readonly'));
  });
});
