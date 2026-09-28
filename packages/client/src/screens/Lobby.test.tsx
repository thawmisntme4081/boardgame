import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { codeFromPath } from '@/session';
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
    expect(api.createRoom).toHaveBeenCalledWith('Ana');
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
    render(<WaitingRoom code="QRST" missing="pilot" />);
    expect(screen.getByText('Waiting for your pilot')).toBeInTheDocument();
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
