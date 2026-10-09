import type { PandemicLobby } from '@pandemic/rules/definition';
import type { WaitingView } from '@pandemic/rules';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETUP } from './setup';
import { SetupForm } from './SetupForm';
import { WaitingInfo } from './WaitingInfo';

/** The form with its value kept, as the platform's page does; `onChange` sees every change. */
function Form({ onChange }: { onChange: (setup: PandemicLobby) => void }) {
  const [value, setValue] = useState<PandemicLobby>(DEFAULT_SETUP);
  return (
    <SetupForm
      value={value}
      onChange={(setup) => {
        setValue(setup);
        onChange(setup);
      }}
    />
  );
}

const waiting = (over: Partial<WaitingView> = {}): WaitingView => ({
  status: 'waiting',
  you: 'p1',
  seated: ['p1'],
  players: 3,
  epidemics: 4,
  ...over,
});

describe('the lobby options (SetupForm)', () => {
  it('starts at 2 players and offers 2, 3 and 4', () => {
    render(<Form onChange={vi.fn()} />);
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['2', '3', '4']);
    expect(screen.getByRole('radio', { name: '2' })).toBeChecked();
  });

  it('chooses the number of players', async () => {
    const onChange = vi.fn();
    render(<Form onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: '4' }));
    expect(screen.getByRole('radio', { name: '4' })).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith({ players: 4 });
  });
});

describe('the waiting room (WaitingInfo)', () => {
  it('says how many players are missing', () => {
    render(<WaitingInfo view={waiting()} />);
    expect(screen.getByText('Waiting for 2 more players')).toBeInTheDocument();
    expect(screen.getByText(/3 players/)).toBeInTheDocument();
  });

  it('uses the singular for the last player', () => {
    render(<WaitingInfo view={waiting({ players: 2 })} />);
    expect(screen.getByText('Waiting for 1 more player')).toBeInTheDocument();
  });
});
