// The Teacher on the board: the students on the map, choosing the pawn for the turn, the
// "Create a student" button, the role card, and the moves of the chosen pawn.
import {
  actingPawn,
  createGame,
  viewFor,
  type GameState,
  type PandemicMove,
  type PandemicView,
} from '@pandemic/rules';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionBar } from './components/ActionBar';
import { MapPieces } from './components/MapPieces';
import { RoleCards } from './components/RoleCards';
import { movesTo, reachableCities } from './lib/moves';
import { usePandemic } from './store';
import { CITIES } from '@pandemic/rules';

const send = vi.fn<(move: PandemicMove) => Promise<void>>(() => Promise.resolve());
vi.mock('./platform', () => ({ platform: () => ({ send }) }));

const presence = {
  p1: { name: 'Ana', online: true, creator: true },
  p2: { name: 'Ben', online: true, creator: false },
  p3: { name: 'Cleo', online: true, creator: false },
};

/** A 3-player game, Ana (p1) the Teacher to move in Atlanta, with a student in Chicago. */
function teacherGame(chosen: 'p1' | 'p1-s1' | null = null): GameState {
  const g = createGame({ seats: ['p1', 'p2', 'p3'], epidemics: 4, seed: 1 });
  g.roles = { p1: 'teacher', p2: 'scientist', p3: 'medic' };
  g.hands = { p1: [], p2: [], p3: [] };
  g.pawns = { p1: 'atlanta', 'p1-s1': 'chicago', p2: 'atlanta', p3: 'atlanta' };
  g.stations = ['atlanta'];
  g.pending = null;
  g.turn = { ...g.turn, seat: 'p1', pawn: chosen, actionsLeft: 4, step: 'actions' };
  return g;
}
const seen = (g: GameState, seat: 'p1' | 'p2' | 'p3'): PandemicView => viewFor(g, seat);

beforeEach(() => {
  send.mockClear();
  usePandemic.getState().reset();
});

describe('the pawns on the map', () => {
  it('draws a student next to the teacher pawn, named after its owner, and marks only the teacher', () => {
    const { container } = render(
      <svg>
        <MapPieces view={seen(teacherGame('p1'), 'p1')} presence={presence} />
      </svg>,
    );
    const ids = [...container.querySelectorAll('[data-pawn]')].map((el) =>
      el.getAttribute('data-pawn'),
    );
    expect(ids.sort()).toEqual(['p1', 'p1-s1', 'p2', 'p3']);
    expect(container.querySelector('[data-pawn="p1-s1"] title')?.textContent).toBe("Ana's student");
    expect(container.querySelector('[data-pawn="p1"] title')?.textContent).toBe('Ana');
    expect(container.querySelector('[data-pawn="p1"] [data-mark]')).not.toBeNull();
    expect(container.querySelector('[data-pawn="p1-s1"] [data-mark]')).toBeNull();
    // Other roles' pawns have no mark.
    expect(container.querySelector('[data-pawn="p2"] [data-mark]')).toBeNull();
  });
});

describe('choosing the pawn', () => {
  it('asks the Teacher with a student at the start of the turn, one button for each pawn', () => {
    render(<ActionBar view={seen(teacherGame(null), 'p1')} presence={presence} />);
    const group = screen.getByRole('group', { name: 'Choose the pawn for this turn' });
    fireEvent.click(within(group).getByRole('button', { name: 'Student 1 in Chicago' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'choose-pawn', pawn: 'p1-s1' });
    fireEvent.click(within(group).getByRole('button', { name: 'Teacher pawn in Atlanta' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'choose-pawn', pawn: 'p1' });
    // No action is offered before the choice.
    expect(screen.queryByRole('button', { name: 'Create a student' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pass' })).toBeNull();
  });

  it('shows the pawn of the turn once chosen, and no more choice', () => {
    render(<ActionBar view={seen(teacherGame('p1-s1'), 'p1')} presence={presence} />);
    expect(screen.queryByRole('group', { name: 'Choose the pawn for this turn' })).toBeNull();
    expect(screen.getByText('This turn: Student 1 in Chicago')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pass' })).toBeInTheDocument();
  });

  it('never asks the other players, nor a Teacher without students', () => {
    const { rerender } = render(
      <ActionBar view={seen(teacherGame(null), 'p2')} presence={presence} />,
    );
    expect(screen.queryByRole('group', { name: 'Choose the pawn for this turn' })).toBeNull();
    const alone = teacherGame('p1');
    delete alone.pawns['p1-s1'];
    rerender(<ActionBar view={seen(alone, 'p1')} presence={presence} />);
    expect(screen.queryByRole('group', { name: 'Choose the pawn for this turn' })).toBeNull();
    expect(screen.queryByText(/^This turn:/)).toBeNull();
  });
});

describe('creating a student', () => {
  it('offers the button to the teacher pawn, and sends the move', () => {
    const game = teacherGame('p1');
    delete game.pawns['p1-s1'];
    render(<ActionBar view={seen(game, 'p1')} presence={presence} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create a student' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'create-student' });
  });

  it('is not offered from a student, nor once both students exist, nor to another role', () => {
    const { rerender } = render(
      <ActionBar view={seen(teacherGame('p1-s1'), 'p1')} presence={presence} />,
    );
    expect(screen.queryByRole('button', { name: 'Create a student' })).toBeNull();

    const full = teacherGame('p1');
    full.pawns['p1-s2'] = 'atlanta';
    rerender(<ActionBar view={seen(full, 'p1')} presence={presence} />);
    expect(screen.queryByRole('button', { name: 'Create a student' })).toBeNull();

    const other = teacherGame('p1');
    other.roles.p1 = 'medic';
    rerender(<ActionBar view={seen(other, 'p1')} presence={presence} />);
    expect(screen.queryByRole('button', { name: 'Create a student' })).toBeNull();
  });
});

describe('the role card', () => {
  it('counts the Teacher’s students', () => {
    render(<RoleCards view={seen(teacherGame('p1'), 'p1')} presence={presence} />);
    expect(screen.getByText('Students: 1 / 2')).toBeInTheDocument();
    expect(screen.getByLabelText('What Teacher can do')).toBeInTheDocument();
  });
});

describe('the map moves the chosen pawn', () => {
  it('moves the student from its own city, without naming a pawn in the move', () => {
    const view = seen(teacherGame('p1-s1'), 'p1');
    expect(actingPawn(view, 'p1')).toBe('p1-s1');
    // Chicago's neighbors, not Atlanta's.
    expect(movesTo(view, 'p1', 'montreal')).toEqual([{ type: 'drive', to: 'montreal' }]);
    expect(movesTo(view, 'p1', 'washington')).toEqual([]);
    const reach = reachableCities(view, 'p1', CITIES);
    expect(reach.has('montreal')).toBe(true);
    expect(reach.has('washington')).toBe(false);
  });

  it('moves the teacher pawn when it is the chosen one', () => {
    const view = seen(teacherGame('p1'), 'p1');
    expect(movesTo(view, 'p1', 'washington')).toEqual([{ type: 'drive', to: 'washington' }]);
    expect(movesTo(view, 'p1', 'montreal')).toEqual([]);
  });

  it('lets a Dispatcher pick any pawn to move, a student included', () => {
    const game = teacherGame('p1');
    game.roles = { p1: 'teacher', p2: 'dispatcher', p3: 'medic' };
    game.turn = { ...game.turn, seat: 'p2', pawn: 'p2' };
    render(<ActionBar view={seen(game, 'p2')} presence={presence} />);
    const group = screen.getByRole('group', { name: 'Pawn to move' });
    expect(within(group).getByRole('button', { name: "Ana's student" })).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('button', { name: "Ana's student" }));
    expect(usePandemic.getState().movingPawn).toBe('p1-s1');
  });
});
