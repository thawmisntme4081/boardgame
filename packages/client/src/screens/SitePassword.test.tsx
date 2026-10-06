import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { useGame } from '@/store';
import { resetStore } from '@/test/fixtures';
import { SitePassword } from './SitePassword';

vi.mock('@/api', () => ({
  checkSiteAccess: vi.fn(async () => true),
  enterSitePassword: vi.fn(async () => 'ok'),
  startConnection: vi.fn(),
  createRoom: vi.fn(async () => true),
  joinRoom: vi.fn(async () => true),
  leaveGame: vi.fn(),
  shareInvite: vi.fn(async () => {}),
}));
const api = await import('@/api');

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

describe('the site password gate', () => {
  it('asks for the password first and connects the game only once it is open', async () => {
    vi.mocked(api.checkSiteAccess).mockResolvedValueOnce(false);
    useGame.setState({ siteAccess: 'checking' });
    render(<App />);
    expect(await screen.findByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create a game' })).toBeNull();
    expect(api.startConnection).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Password'), 'bay-cung-nhau');
    await userEvent.click(screen.getByRole('button', { name: 'Enter' }));
    expect(api.enterSitePassword).toHaveBeenCalledWith('bay-cung-nhau');
    expect(await screen.findByRole('button', { name: 'Create a game' })).toBeInTheDocument();
    expect(api.startConnection).toHaveBeenCalled();
  });

  it('goes straight to the lobby when the site is open (no password, or already entered)', async () => {
    useGame.setState({ siteAccess: 'checking' });
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Create a game' })).toBeInTheDocument();
    await waitFor(() => expect(api.startConnection).toHaveBeenCalled());
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('says when the password is wrong, and when there were too many tries', async () => {
    useGame.setState({ siteAccess: 'locked' });
    render(<SitePassword />);
    vi.mocked(api.enterSitePassword).mockResolvedValueOnce('wrong-password');
    await userEvent.type(screen.getByLabelText('Password'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Enter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong password.');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(useGame.getState().siteAccess).toBe('locked');

    vi.mocked(api.enterSitePassword).mockResolvedValueOnce('too-many-tries');
    await userEvent.type(screen.getByLabelText('Password'), 'again');
    await userEvent.click(screen.getByRole('button', { name: 'Enter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many tries');
  });

  it('cannot be sent empty', () => {
    useGame.setState({ siteAccess: 'locked' });
    render(<SitePassword />);
    expect(screen.getByRole('button', { name: 'Enter' })).toBeDisabled();
  });
});
