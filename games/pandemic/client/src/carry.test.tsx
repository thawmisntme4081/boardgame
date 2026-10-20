// The Relocation Specialist on the board: choosing what to take along, the moves and answers that
// carry it, the prompt for a pawn taken along; and the new roles' cards and action counts.
import {
  applyMove,
  createGame,
  viewFor,
  type GameState,
  type PandemicMove,
  type PandemicView,
} from '@pandemic/rules';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionBar } from './components/ActionBar';
import { MoveMenu } from './components/MoveMenu';
import { Prompts } from './components/Prompts';
import { RoleCards } from './components/RoleCards';
import { movesTo } from './lib/moves';
import { NO_CARRY, usePandemic } from './store';

const send = vi.fn<(move: PandemicMove) => Promise<void>>(() => Promise.resolve());
vi.mock('./platform', () => ({ platform: () => ({ send }) }));

const presence = {
  p1: { name: 'Ana', online: true, creator: true },
  p2: { name: 'Ben', online: true, creator: false },
  p3: { name: 'Cleo', online: true, creator: false },
};

/** A 3-player game, Ana (p1) the Relocation Specialist to move in Atlanta, 2 blue + 1 red cubes there. */
function relocationGame(): GameState {
  const g = createGame({ seats: ['p1', 'p2', 'p3'], epidemics: 4, seed: 1 });
  g.roles = { p1: 'relocation-specialist', p2: 'scientist', p3: 'medic' };
  g.hands = { p1: [], p2: [], p3: [] };
  g.pawns = { p1: 'atlanta', p2: 'atlanta', p3: 'miami' };
  for (const id of Object.keys(g.cubes)) {
    g.cubes[id as keyof typeof g.cubes] = { blue: 0, yellow: 0, black: 0, red: 0 };
  }
  g.cubes.atlanta = { blue: 2, yellow: 0, black: 0, red: 1 };
  g.stations = ['atlanta'];
  g.pending = null;
  g.turn = { ...g.turn, seat: 'p1', pawn: 'p1', actionsLeft: 4, step: 'actions' };
  return g;
}
const seen = (g: GameState, seat: 'p1' | 'p2' | 'p3'): PandemicView => viewFor(g, seat);

beforeEach(() => {
  send.mockClear();
  usePandemic.getState().reset();
});

describe('choosing what to take along', () => {
  it('offers a plus and a minus for each color in the city, and a button for the pawn there', () => {
    render(<ActionBar view={seen(relocationGame(), 'p1')} presence={presence} />);
    const along = screen.getByRole('group', { name: 'Take along' });
    expect(within(along).getByText('Blue: 0')).toBeInTheDocument();
    expect(within(along).getByText('Red: 0')).toBeInTheDocument();
    // Colors with no cube in the city are not offered.
    expect(within(along).queryByText(/Yellow/)).toBeNull();
    expect(within(along).getByRole('button', { name: 'Take Ben' })).toBeInTheDocument();
    // Cleo is in Miami.
    expect(within(along).queryByRole('button', { name: 'Take Cleo' })).toBeNull();
  });

  it('keeps the choice in the store, up to the cubes in the city and to 3', () => {
    render(<ActionBar view={seen(relocationGame(), 'p1')} presence={presence} />);
    const more = (color: string) => screen.getByRole('button', { name: `One more ${color} cube` });
    fireEvent.click(more('Blue'));
    fireEvent.click(more('Blue'));
    expect(more('Blue')).toBeDisabled(); // only 2 there
    fireEvent.click(more('Red'));
    expect(screen.getByText('3 / 3 cubes')).toBeInTheDocument();
    expect(more('Red')).toBeDisabled();
    expect(usePandemic.getState().carry.cubes).toEqual(['blue', 'blue', 'red']);

    fireEvent.click(screen.getByRole('button', { name: 'One fewer Blue cube' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take Ben' }));
    expect(usePandemic.getState().carry).toEqual({ cubes: ['blue', 'red'], pawn: 'p2' });
    fireEvent.click(screen.getByRole('button', { name: 'Take Ben' }));
    expect(usePandemic.getState().carry).toEqual({ cubes: ['blue', 'red'] });
  });

  it('is not shown to other roles, on others’ turns, or when the city has nothing to take', () => {
    const { rerender } = render(
      <ActionBar view={seen(relocationGame(), 'p2')} presence={presence} />,
    );
    expect(screen.queryByRole('group', { name: 'Take along' })).toBeNull();

    const other = relocationGame();
    other.roles.p1 = 'medic';
    rerender(<ActionBar view={seen(other, 'p1')} presence={presence} />);
    expect(screen.queryByRole('group', { name: 'Take along' })).toBeNull();

    const alone = relocationGame();
    alone.cubes.atlanta = { blue: 0, yellow: 0, black: 0, red: 0 };
    alone.pawns.p2 = 'miami';
    rerender(<ActionBar view={seen(alone, 'p1')} presence={presence} />);
    expect(screen.queryByRole('group', { name: 'Take along' })).toBeNull();
  });

  it('is forgotten when the turn moves on', () => {
    const before = seen(relocationGame(), 'p1');
    usePandemic.getState().setCarry({ cubes: ['blue'] });
    const moved = applyMove(relocationGame(), 'p1', { type: 'drive', to: 'chicago' });
    usePandemic.getState().onView(seen(moved, 'p1'), before);
    expect(usePandemic.getState().carry).toEqual(NO_CARRY);
  });
});

describe('moving with what was chosen', () => {
  it('sends the drive with the cubes and the pawn that come along', () => {
    usePandemic.getState().setCarry({ cubes: ['blue', 'red'], pawn: 'p2' });
    const view = seen(relocationGame(), 'p1');
    render(
      <svg>
        <MoveMenu view={view} you="p1" city="chicago" presence={presence} onDone={() => {}} />
      </svg>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Drive / Ferry' }));
    expect(send).toHaveBeenCalledWith({
      type: 'drive',
      to: 'chicago',
      carry: { cubes: ['blue', 'red'], pawn: 'p2' },
    });
  });

  it('sends no carry when nothing was chosen, and only for its own pawn', () => {
    const view = seen(relocationGame(), 'p1');
    expect(movesTo(view, 'p1', 'chicago')).toEqual([{ type: 'drive', to: 'chicago' }]);
    expect(movesTo(view, 'p1', 'chicago', 'p1', { cubes: ['blue'] })).toEqual([
      { type: 'drive', to: 'chicago', carry: { cubes: ['blue'] } },
    ]);
  });
});

describe('answering a move', () => {
  /** Ana (Relocation Specialist) takes Ben's pawn and a cube along: Ben is asked. */
  function offeredToBen(): GameState {
    return applyMove(relocationGame(), 'p1', {
      type: 'drive',
      to: 'chicago',
      carry: { cubes: ['blue'], pawn: 'p2' },
    });
  }

  it('tells the owner of the pawn taken along, who accepts or declines', () => {
    render(<Prompts view={seen(offeredToBen(), 'p2')} presence={presence} />);
    expect(screen.getByText(/Ana offers to take Ben along to Chicago\./)).toBeInTheDocument();
    expect(screen.getByText(/1 cube comes along\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'move-accept' });
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'move-decline' });
  });

  it('lets the mover cancel, and asks the others nothing', () => {
    const { rerender } = render(<Prompts view={seen(offeredToBen(), 'p1')} presence={presence} />);
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel the offer' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'move-cancel' });
    rerender(<Prompts view={seen(offeredToBen(), 'p3')} presence={presence} />);
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
  });

  it('lets a moved Relocation Specialist choose what comes along when accepting', () => {
    const game = relocationGame();
    game.roles = { p1: 'dispatcher', p2: 'relocation-specialist', p3: 'medic' };
    const offered = applyMove(game, 'p1', { type: 'drive', to: 'chicago', pawn: 'p2' });
    render(<Prompts view={seen(offered, 'p2')} presence={presence} />);
    fireEvent.click(screen.getByRole('button', { name: 'One more Blue cube' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take Ana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(send).toHaveBeenLastCalledWith({
      type: 'move-accept',
      carry: { cubes: ['blue'], pawn: 'p1' },
    });
  });

  it('does not offer the choice to anyone else, nor once it was made', () => {
    const game = relocationGame();
    game.roles = { p1: 'dispatcher', p2: 'relocation-specialist', p3: 'medic' };
    const offered = applyMove(game, 'p1', { type: 'drive', to: 'chicago', pawn: 'p2' });
    render(<Prompts view={seen(offered, 'p1')} presence={presence} />);
    expect(screen.queryByRole('group', { name: 'Take along' })).toBeNull();
  });
});

describe('the new roles’ cards and actions', () => {
  it('name the three roles, each with its power', () => {
    const game = relocationGame();
    game.roles = { p1: 'relocation-specialist', p2: 'crisis-mitigator', p3: 'generalist' };
    render(<RoleCards view={seen(game, 'p1')} presence={presence} />);
    expect(screen.getByLabelText('What Relocation Specialist can do')).toBeInTheDocument();
    expect(screen.getByLabelText('What Crisis Mitigator can do')).toBeInTheDocument();
    expect(screen.getByLabelText('What Generalist can do')).toBeInTheDocument();
  });

  it('show the actions a Generalist and a Crisis Mitigator have', () => {
    const game = relocationGame();
    game.roles.p1 = 'generalist';
    game.turn.actionsLeft = 5;
    const { rerender } = render(<ActionBar view={seen(game, 'p1')} presence={presence} />);
    expect(screen.getByText('5 actions left')).toBeInTheDocument();
    game.roles.p1 = 'crisis-mitigator';
    game.turn.actionsLeft = 7;
    rerender(<ActionBar view={seen(game, 'p1')} presence={presence} />);
    expect(screen.getByText('7 actions left')).toBeInTheDocument();
  });
});
