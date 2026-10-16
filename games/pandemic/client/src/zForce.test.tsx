// The Z-Force Team Member on the board: its card, the moves to Montreal and Essen, picking other
// players' cards for a cure, and the prompt the helpers answer.
import {
  createGame,
  viewFor,
  type GameState,
  type PandemicMove,
  type PandemicView,
} from '@pandemic/rules';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionBar } from './components/ActionBar';
import { Prompts } from './components/Prompts';
import { RoleCards } from './components/RoleCards';
import { usePandemic } from './store';

const send = vi.fn<(move: PandemicMove) => Promise<void>>(() => Promise.resolve());
vi.mock('./platform', () => ({ platform: () => ({ send }) }));

const presence = {
  p1: { name: 'Ana', online: true, creator: true },
  p2: { name: 'Ben', online: true, creator: false },
  p3: { name: 'Cleo', online: true, creator: false },
};

const cards = (...ids: string[]) => ids.map((city) => ({ kind: 'city' as const, city }));

/**
 * A 3-player game, Ana (p1) the Z-Force Team Member to move at Atlanta's station with 3 blue
 * cards; Ben is there with 2, Cleo in Miami with 1.
 */
function zForceGame(): GameState {
  const g = createGame({ seats: ['p1', 'p2', 'p3'], epidemics: 4, seed: 1 });
  g.roles = { p1: 'z-force-team-member', p2: 'scientist', p3: 'medic' };
  g.hands = {
    p1: cards('chicago', 'montreal', 'new-york') as never,
    p2: cards('london', 'madrid') as never,
    p3: cards('paris') as never,
  };
  g.pawns = { p1: 'atlanta', p2: 'atlanta', p3: 'miami' };
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

describe('the role card', () => {
  it('names the role and its power', () => {
    render(<RoleCards view={seen(zForceGame(), 'p1')} presence={presence} />);
    expect(screen.getByLabelText('What Z-Force Team Member can do')).toBeInTheDocument();
  });
});

describe('Montreal and Essen', () => {
  it('offers one button for each city and sends the move', () => {
    render(<ActionBar view={seen(zForceGame(), 'p1')} presence={presence} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to Essen' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'montreal-essen', to: 'essen' });
    fireEvent.click(screen.getByRole('button', { name: 'Go to Montreal' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'montreal-essen', to: 'montreal' });
  });

  it('leaves out the city the pawn is in, other roles and other turns', () => {
    const game = zForceGame();
    game.pawns.p1 = 'montreal';
    const { rerender } = render(<ActionBar view={seen(game, 'p1')} presence={presence} />);
    expect(screen.queryByRole('button', { name: 'Go to Montreal' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Go to Essen' })).toBeInTheDocument();

    const other = zForceGame();
    other.roles.p1 = 'medic';
    rerender(<ActionBar view={seen(other, 'p1')} presence={presence} />);
    expect(screen.queryByRole('button', { name: 'Go to Essen' })).toBeNull();

    rerender(<ActionBar view={seen(zForceGame(), 'p2')} presence={presence} />);
    expect(screen.queryByRole('button', { name: 'Go to Essen' })).toBeNull();
  });
});

describe('picking cards for a cure', () => {
  it('offers the cure with the cards of the players in the city, and sends who gives what', () => {
    render(<ActionBar view={seen(zForceGame(), 'p1')} presence={presence} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cure: Blue' }));

    // Ben's cards are listed, Cleo's (in Miami) are not.
    expect(screen.getByRole('button', { name: 'London (Ben)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Madrid (Ben)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Paris (Cleo)' })).toBeNull();

    const confirm = screen.getByRole('button', { name: 'Discover the cure' });
    expect(confirm).toBeDisabled();
    for (const name of ['Chicago', 'Montreal', 'New York', 'London (Ben)']) {
      fireEvent.click(screen.getByRole('button', { name }));
    }
    expect(confirm).toBeDisabled(); // 4 of 5
    fireEvent.click(screen.getByRole('button', { name: 'Madrid (Ben)' }));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(send).toHaveBeenLastCalledWith({
      type: 'cure',
      color: 'blue',
      cards: ['chicago', 'montreal', 'new-york'],
      help: [
        { seat: 'p2', city: 'london' },
        { seat: 'p2', city: 'madrid' },
      ],
    });
  });

  it('does not offer it when the cards, even with the helpers’, do not make 5', () => {
    const game = zForceGame();
    game.hands.p2 = cards('london') as never;
    render(<ActionBar view={seen(game, 'p1')} presence={presence} />);
    expect(screen.queryByRole('button', { name: 'Cure: Blue' })).toBeNull();
  });

  it('keeps the plain cure for any other role, with no helpers in the picker', () => {
    const game = zForceGame();
    game.roles.p1 = 'researcher';
    game.hands.p1 = cards('chicago', 'montreal', 'new-york', 'paris', 'essen') as never;
    render(<ActionBar view={seen(game, 'p1')} presence={presence} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cure: Blue' }));
    expect(send).toHaveBeenLastCalledWith({
      type: 'cure',
      color: 'blue',
      cards: ['chicago', 'montreal', 'new-york', 'paris', 'essen'],
    });
  });
});

describe('answering a cure', () => {
  /** Ana asks Ben for London and Madrid. */
  function offered(): GameState {
    const game = zForceGame();
    game.pending = {
      kind: 'cure',
      by: 'p1',
      waiting: ['p2'],
      move: {
        type: 'cure',
        color: 'blue',
        cards: ['chicago', 'montreal', 'new-york'],
        help: [
          { seat: 'p2', city: 'london' },
          { seat: 'p2', city: 'madrid' },
        ],
      },
    };
    return game;
  }

  it('tells the helper which cards, who accepts or declines', () => {
    render(<Prompts view={seen(offered(), 'p2')} presence={presence} />);
    expect(
      screen.getByText(/Ana asks to use London \(Ben\), Madrid \(Ben\) to cure Blue\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Waiting for Ben to agree\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Give the cards' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'cure-accept' });
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'cure-decline' });
  });

  it('lets the player cancel, and asks nobody else', () => {
    const { rerender } = render(<Prompts view={seen(offered(), 'p1')} presence={presence} />);
    expect(screen.queryByRole('button', { name: 'Give the cards' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel the cure' }));
    expect(send).toHaveBeenLastCalledWith({ type: 'cure-cancel' });

    rerender(<Prompts view={seen(offered(), 'p3')} presence={presence} />);
    const section = screen.getByRole('region', { name: 'Discover a cure' });
    expect(within(section).queryByRole('button')).toBeNull();
  });
});
