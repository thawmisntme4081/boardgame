import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGame } from '../games';
import { loadAccount, type AccountUser } from '../account';
import { usePlatform } from '../store';
import { renderAt, resetStore } from '../test/fixtures';

vi.mock('../api', () => ({
  createRoom: vi.fn(async () => true),
  joinRoom: vi.fn(async () => true),
  leaveGame: vi.fn(),
  shareInvite: vi.fn(async () => {}),
  setNavigate: vi.fn(),
}));

// The game's module is a separate chunk: transformed once, up front (slow on a cold run).
beforeAll(() => loadGame('sky-team'), 60_000);

/** The server's account endpoints, in memory: one user, signed in or not. */
function fakeServer({ google = true, user = null as AccountUser | null } = {}) {
  const state = { user, code: '' };
  const calls: string[] = [];
  const reply = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));
  vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
    calls.push(input);
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, string>) : {};
    switch (input) {
      case '/auth/methods':
        return reply({ google, email: true });
      case '/auth/me':
        return reply(state.user);
      case '/api/auth/email-otp/send-verification-otp':
        state.code = '123456';
        return reply({ success: true });
      case '/api/auth/sign-in/email-otp':
        if (body.otp !== state.code) return reply({ code: 'INVALID_OTP' }, 400);
        state.user = { id: 'u1', name: '', email: body.email!, image: null };
        return reply({ user: state.user });
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
  it('shows "Sign in" on the game picker and the game page; the name stays editable', async () => {
    fakeServer();
    await loadAccount();
    const { router } = await renderAt('/');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your name')).not.toHaveAttribute('readonly');

    await router.navigate({ to: '/play/$gameId', params: { gameId: 'sky-team' } });
    expect(await screen.findByRole('button', { name: 'Create a game' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows no sign-in at all when the server has no accounts', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('Not found', { status: 404 })));
    await loadAccount();
    expect(usePlatform.getState().account).toBe('off');
    await renderAt('/');
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  });

  it('offers Google only when the server has it', async () => {
    fakeServer({ google: false });
    await loadAccount();
    await renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign in' });
    expect(within(dialog).queryByRole('button', { name: 'Continue with Google' })).toBeNull();
    expect(within(dialog).getByLabelText('Email')).toBeInTheDocument();
  });
});

describe('signing in with an email code', () => {
  it('sends a code, signs in, asks the name once, then shows it fixed in the lobby', async () => {
    const server = fakeServer();
    await loadAccount();
    await renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign in' });
    expect(
      within(dialog).getByRole('button', { name: 'Continue with Google' }),
    ).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText('Email'), 'dao@example.com');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Email me a code' }));
    expect(
      await within(dialog).findByText(/sent a 6-digit code to dao@example.com/),
    ).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Code'), '12x3456');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sign in' }));

    // A first email sign-in has no name: it is asked once, and the dialog cannot be skipped.
    const ask = await screen.findByRole('dialog', { name: 'Choose your name' });
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Choose your name' })).toBeInTheDocument();
    await userEvent.type(within(ask).getByLabelText('Your name'), 'Đào');
    await userEvent.click(within(ask).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Account: Đào' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    const field = screen.getByLabelText('Your name');
    expect(field).toHaveValue('Đào');
    expect(field).toHaveAttribute('readonly');
    expect(screen.getByText("Your account's name.")).toBeInTheDocument();
    expect(server.calls).toContain('/auth/name');
  });

  it('says when the code is wrong and lets the player try again', async () => {
    fakeServer();
    await loadAccount();
    await renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign in' });
    await userEvent.type(within(dialog).getByLabelText('Email'), 'ben@example.com');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Email me a code' }));
    await userEvent.type(await within(dialog).findByLabelText('Code'), '000000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sign in' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Wrong or expired code.');
    expect(within(dialog).getByLabelText('Code')).toHaveValue('');
    expect(usePlatform.getState().account).toMatchObject({ user: null });
  });
});

describe('signed in', () => {
  it('shows the name and a menu with the email; signing out brings "Sign in" back', async () => {
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
