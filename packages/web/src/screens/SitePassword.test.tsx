import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { usePlatform } from '@/store';
import { resetStore } from '@/test/fixtures';
import { SitePassword } from './SitePassword';

vi.mock('@/api', () => ({
  checkSiteAccess: vi.fn(async () => true),
  enterSitePassword: vi.fn(async () => 'ok'),
  startConnection: vi.fn(),
  setNavigate: vi.fn(),
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
    usePlatform.setState({ siteAccess: 'checking' });
    render(<App />);
    expect(await screen.findByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Sky Team/ })).toBeNull();
    expect(api.startConnection).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Password'), 'bay-cung-nhau');
    await userEvent.click(screen.getByRole('button', { name: 'Enter' }));
    expect(api.enterSitePassword).toHaveBeenCalledWith('bay-cung-nhau');
    expect(await screen.findByRole('link', { name: /^Sky Team/ })).toBeInTheDocument();
    expect(api.startConnection).toHaveBeenCalled();
  });

  it('goes straight to the game picker when the site is open (no password, or already entered)', async () => {
    usePlatform.setState({ siteAccess: 'checking' });
    render(<App />);
    expect(await screen.findByRole('link', { name: /^Sky Team/ })).toBeInTheDocument();
    await waitFor(() => expect(api.startConnection).toHaveBeenCalled());
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('says when the password is wrong, and when there were too many tries', async () => {
    usePlatform.setState({ siteAccess: 'locked' });
    render(<SitePassword />);
    vi.mocked(api.enterSitePassword).mockResolvedValueOnce('wrong-password');
    await userEvent.type(screen.getByLabelText('Password'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Enter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong password.');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(usePlatform.getState().siteAccess).toBe('locked');

    vi.mocked(api.enterSitePassword).mockResolvedValueOnce('too-many-tries');
    await userEvent.type(screen.getByLabelText('Password'), 'again');
    await userEvent.click(screen.getByRole('button', { name: 'Enter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many tries');
  });

  it('cannot be sent empty', () => {
    usePlatform.setState({ siteAccess: 'locked' });
    render(<SitePassword />);
    expect(screen.getByRole('button', { name: 'Enter' })).toBeDisabled();
  });
});
