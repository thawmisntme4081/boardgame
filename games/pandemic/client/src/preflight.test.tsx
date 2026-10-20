// Pandemic 06: the "before the game" panel: roles, confirm, undo, leaving.
import {
  applyPreflight,
  beginSetup,
  tableViewFor,
  type PreflightMove,
  type RoleMode,
  type SeatId,
  type SetupView,
} from '@pandemic/rules';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Preflight } from './components/Preflight';

const send = vi.fn<(move: PreflightMove) => Promise<void>>(() => Promise.resolve());
const leave = vi.fn(() => Promise.resolve());
vi.mock('./platform', () => ({ platform: () => ({ send, leave }) }));

const SEATS: SeatId[] = ['p1', 'p2', 'p3'];

/** The step as `you` sees it; `moves` are made first, as `[seat, move]`. */
function stepFor(
  roleMode: RoleMode,
  you: SeatId,
  moves: [SeatId, PreflightMove][] = [],
): SetupView {
  let state = beginSetup({ seats: SEATS, epidemics: 5, roleMode, seed: 5 });
  for (const [seat, move] of moves) state = applyPreflight(state, seat, move) as typeof state;
  return tableViewFor(state, you) as SetupView;
}

beforeEach(() => {
  send.mockClear();
  leave.mockClear();
});

describe('the "before the game" panel', () => {
  it('shows the difficulty and the role mode, and the roles dealt at random with their players', () => {
    render(<Preflight view={stepFor('random', 'p1')} presence={null} />);
    expect(screen.getByRole('heading', { name: 'Before the game' })).toBeInTheDocument();
    expect(screen.getByText(/5 epidemic cards/)).toBeInTheDocument();
    expect(screen.getByText(/roles dealt at random/)).toBeInTheDocument();
    expect(document.querySelectorAll('[data-role]')).toHaveLength(3);
    // Each card names its player, and yours says so.
    expect(screen.getByText('p1 (you)')).toBeInTheDocument();
    expect(screen.getByText('p2')).toBeInTheDocument();
    // Nothing to pick in this mode: no role buttons.
    expect(screen.queryByRole('group', { name: 'Roles' })).toBeNull();
    expect(document.querySelectorAll('button:has([data-role])')).toHaveLength(0);
  });

  it('confirms, then offers to undo, and a check marks who is ready', () => {
    const { rerender } = render(<Preflight view={stepFor('random', 'p1')} presence={null} />);
    expect(screen.queryByLabelText('Ready')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and start' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'confirm' });

    const confirmed = stepFor('random', 'p1', [['p1', { type: 'confirm' }]]);
    rerender(<Preflight view={confirmed} presence={null} />);
    expect(screen.getAllByLabelText('Ready')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Confirm and start' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'unconfirm' });
  });

  it('leaves the game', () => {
    render(<Preflight view={stepFor('random', 'p2')} presence={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('offers every role to pick when the players choose, and confirm needs a role', () => {
    render(<Preflight view={stepFor('choose', 'p1')} presence={null} />);
    expect(screen.getByText(/roles chosen by the players/)).toBeInTheDocument();
    const roles = within(screen.getByRole('group', { name: 'Roles' })).getAllByRole('button');
    expect(roles).toHaveLength(12);
    expect(screen.getByRole('button', { name: 'Confirm and start' })).toBeDisabled();

    fireEvent.click(document.querySelector('button:has([data-role="medic"])')!);
    expect(send).toHaveBeenLastCalledWith({ type: 'pick-role', role: 'medic' });
  });

  it('marks the role you hold and the ones others hold, which cannot be picked', () => {
    const view = stepFor('choose', 'p1', [
      ['p1', { type: 'pick-role', role: 'medic' }],
      ['p2', { type: 'pick-role', role: 'scientist' }],
    ]);
    render(<Preflight view={view} presence={null} />);
    const card = (role: string) => document.querySelector(`button:has([data-role="${role}"])`)!;
    expect(card('medic')).toHaveAttribute('aria-pressed', 'true');
    expect(card('medic')).toBeEnabled();
    expect(card('scientist')).toBeDisabled();
    expect(card('scientist')).toHaveTextContent('p2');
    // A free role can be picked instead.
    expect(card('researcher')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Confirm and start' })).toBeEnabled();
  });

  it('locks the roles once you confirmed, and shows the check on your role', () => {
    const view = stepFor('choose', 'p1', [
      ['p1', { type: 'pick-role', role: 'medic' }],
      ['p1', { type: 'confirm' }],
    ]);
    render(<Preflight view={view} presence={null} />);
    for (const role of document.querySelectorAll('button:has([data-role])')) {
      expect(role).toBeDisabled();
    }
    expect(screen.getByText(/You have confirmed/)).toBeInTheDocument();
    expect(
      within(document.querySelector('[data-role="medic"]') as HTMLElement).getByLabelText('Ready'),
    ).toBeInTheDocument();
  });
});
