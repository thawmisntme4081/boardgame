// Pandemic 05: the event controls: the panel with its "Play" buttons, the map choosing a target,
// the Forecast dialog, and the toast for the others.
import {
  CITIES,
  createGame,
  viewFor,
  type EventId,
  type GameState,
  type PandemicMove,
  type PandemicView,
  type SeatId,
} from '@pandemic/rules';
import { fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Board } from './Board';
import { ActionBar } from './components/ActionBar';
import { EventControls } from './components/EventControls';
import { ForecastDialog } from './components/ForecastDialog';
import { Prompts } from './components/Prompts';
import { eventTargets, moveItem, newEventsOf } from './lib/events';
import { usePandemic } from './store';

const send = vi.fn<(move: PandemicMove) => Promise<void>>(() => Promise.resolve());
vi.mock('./platform', () => ({ platform: () => ({ send }) }));
vi.mock('sonner', () => ({ toast: { message: vi.fn() } }));

const event = (id: EventId) => ({ kind: 'event', event: id }) as const;
const rematch = { by: null, config: null, accepted: [] };

/** A 3-player game, p1 to move, p2 holding `held`; every pawn in Atlanta, one station there. */
function game(...held: EventId[]): GameState {
  const g = createGame({ seats: ['p1', 'p2', 'p3'], epidemics: 4, seed: 1 });
  g.roles = { p1: 'researcher', p2: 'scientist', p3: 'medic' };
  g.hands = { p1: [], p2: held.map(event), p3: [] };
  g.pawns = { p1: 'atlanta', p2: 'atlanta', p3: 'atlanta' };
  g.stations = ['atlanta'];
  g.pending = null;
  g.turn = { ...g.turn, seat: 'p1', actionsLeft: 4, step: 'actions' };
  return g;
}

const seen = (g: GameState, seat: SeatId | 'spectator'): PandemicView => viewFor(g, seat);

beforeEach(() => {
  send.mockClear();
  vi.mocked(toast.message).mockClear();
  usePandemic.getState().reset();
});

describe('the event helpers', () => {
  it('moves an item to a new place and ignores places outside the list', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });

  it('offers the map the cities an Airlift or a Grant can go to, and none for other plans', () => {
    const view = seen(game('airlift'), 'p2');
    const airlift = eventTargets(view, 'p2', { event: 'airlift', owner: 'p2', pawn: 'p3' });
    expect(airlift?.has('tokyo')).toBe(true);
    expect(airlift?.has('atlanta')).toBe(false);
    expect(eventTargets(view, 'p2', { event: 'airlift', owner: 'p2', pawn: null })).toBeNull();

    const grant = eventTargets(view, 'p2', { event: 'government-grant', owner: 'p2', city: null });
    expect(grant?.has('tokyo')).toBe(true);
    expect(grant?.has('atlanta')).toBe(false);
    expect(grant?.size).toBe(CITIES.length - 1);
    expect(
      eventTargets(view, 'p2', { event: 'government-grant', owner: 'p2', city: 'tokyo' }),
    ).toBeNull();
    expect(eventTargets(view, 'p2', { event: 'resilient-population', owner: 'p2' })).toBeNull();
    expect(eventTargets(view, 'p2', null)).toBeNull();
  });

  it('finds the events played in the last move, and none on a new turn or a first view', () => {
    const before = seen(game('airlift'), 'p1');
    const after = structuredClone(before);
    after.log.current.entries.push({ type: 'event', seat: 'p2', event: 'airlift', stored: false });
    expect(newEventsOf(after, before)).toHaveLength(1);
    expect(newEventsOf(after, null)).toEqual([]);
    expect(newEventsOf(after, after)).toEqual([]);
    const next = structuredClone(after);
    next.log = { current: { seat: 'p2', entries: [] }, previous: after.log.current };
    expect(newEventsOf(next, after)).toEqual([]);
  });
});

describe('the store follows events', () => {
  it('announces the events other players play, not your own, and not the old ones', () => {
    const before = seen(game(), 'p1');
    const after = structuredClone(before);
    after.log.current.entries.push(
      { type: 'event', seat: 'p2', event: 'airlift', stored: false },
      { type: 'event', seat: 'p3', event: 'forecast', stored: true },
      { type: 'event', seat: 'p1', event: 'one-quiet-night', stored: false },
    );
    usePandemic.getState().onView(after, before, null);
    const texts = vi.mocked(toast.message).mock.calls.map(([text]) => text);
    expect(texts).toEqual(['p2 played Airlift.', 'p3 played Forecast from the role card.']);
    // The same view again announces nothing.
    vi.mocked(toast.message).mockClear();
    usePandemic.getState().onView(after, after, null);
    expect(toast.message).not.toHaveBeenCalled();
  });

  it('drops a card being played when it can no longer be played', () => {
    const view = seen(game('airlift'), 'p2');
    usePandemic.getState().planEvent({ event: 'airlift', owner: 'p2', pawn: 'p3' });
    usePandemic.getState().onView(view, view, null);
    expect(usePandemic.getState().eventPlan).not.toBeNull();

    const busy = structuredClone(view);
    busy.pending = { kind: 'discard', seat: 'p1' };
    usePandemic.getState().onView(busy, view, null);
    expect(usePandemic.getState().eventPlan).toBeNull();
  });
});

describe('the action bar and events', () => {
  it("is drawn on someone else's turn when any event card is on the table, and not otherwise", () => {
    const { container, rerender } = render(<ActionBar view={seen(game(), 'p3')} presence={null} />);
    expect(container).toBeEmptyDOMElement();
    // p2 holds the card: p2 plays it as their own, p3 as p2's.
    rerender(<ActionBar view={seen(game('airlift'), 'p2')} presence={null} />);
    expect(screen.getByRole('button', { name: 'Play Airlift' })).toBeEnabled();
    expect(screen.queryByText(/actions left/)).toBeNull();
    rerender(<ActionBar view={seen(game('airlift'), 'p3')} presence={null} />);
    expect(screen.getByRole('button', { name: "Play Airlift · p2's card" })).toBeEnabled();
  });

  it("sends another player's card with its owner", () => {
    render(<ActionBar view={seen(game('one-quiet-night'), 'p3')} presence={null} />);
    fireEvent.click(screen.getByRole('button', { name: "Play One Quiet Night · p2's card" }));
    expect(send).toHaveBeenCalledWith({
      type: 'play-event',
      event: 'one-quiet-night',
      owner: 'p2',
    });
  });

  it('shows the actions left and the event buttons on your own turn', () => {
    render(<ActionBar view={seen(game('airlift'), 'p1')} presence={null} />);
    expect(screen.getByText('4 actions left')).toBeInTheDocument();
  });
});

describe('the event buttons', () => {
  it('shows nothing when no event card is on the table', () => {
    const { container } = render(<EventControls view={seen(game(), 'p3')} presence={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('has a Play button for each card held, working out of turn', () => {
    render(<EventControls view={seen(game('one-quiet-night'), 'p2')} presence={null} />);
    const button = screen.getByRole('button', { name: 'Play One Quiet Night' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(send).toHaveBeenCalledWith({ type: 'play-event', event: 'one-quiet-night' });
  });

  it('disables Play at a moment the rules refuse', () => {
    const g = game('one-quiet-night');
    g.turn.step = 'epidemic';
    g.turn.epidemics = 1;
    g.turn.epidemicStep = 'increase';
    render(<EventControls view={seen(g, 'p2')} presence={null} />);
    expect(screen.getByRole('button', { name: 'Play One Quiet Night' })).toBeDisabled();
  });

  it("lists the Contingency Planner's stored card like the others", () => {
    const g = game();
    g.roles.p2 = 'contingency-planner';
    g.contingency = 'forecast';
    render(<EventControls view={seen(g, 'p2')} presence={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play Forecast' }));
    expect(send).toHaveBeenCalledWith({ type: 'play-event', event: 'forecast' });
  });

  it('asks Airlift for a pawn first, then waits for a city on the map', () => {
    const view = seen(game('airlift'), 'p2');
    const { rerender } = render(<EventControls view={view} presence={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play Airlift' }));
    expect(usePandemic.getState().eventPlan).toEqual({ event: 'airlift', owner: 'p2', pawn: null });
    rerender(<EventControls view={view} presence={null} />);
    expect(screen.getByText('Airlift: choose the pawn to move.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^p3 \(in Atlanta\)$/ }));
    expect(usePandemic.getState().eventPlan).toEqual({ event: 'airlift', owner: 'p2', pawn: 'p3' });
    expect(send).not.toHaveBeenCalled();
  });

  it('cancels a card being played', () => {
    usePandemic.getState().planEvent({ event: 'government-grant', owner: 'p2', city: null });
    render(<EventControls view={seen(game('government-grant'), 'p2')} presence={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(usePandemic.getState().eventPlan).toBeNull();
  });

  it('asks which station to take away once all 6 are built', () => {
    const g = game('government-grant');
    g.stations = ['atlanta', 'paris', 'london', 'essen', 'milan', 'chicago'];
    usePandemic.getState().planEvent({ event: 'government-grant', owner: 'p2', city: 'tokyo' });
    render(<EventControls view={seen(g, 'p2')} presence={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Paris' }));
    expect(send).toHaveBeenCalledWith({
      type: 'play-event',
      event: 'government-grant',
      city: 'tokyo',
      move: 'paris',
    });
  });

  it('sends Resilient Population with the card chosen from the infection discard pile', () => {
    const g = game('resilient-population');
    g.infectionDiscard = ['paris', 'london'];
    usePandemic.getState().planEvent({ event: 'resilient-population', owner: 'p2' });
    render(<EventControls view={seen(g, 'p2')} presence={null} />);
    const remove = screen.getByRole('button', { name: 'Remove this card' });
    expect(remove).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'london' } });
    fireEvent.click(remove);
    expect(send).toHaveBeenCalledWith({
      type: 'play-event',
      event: 'resilient-population',
      city: 'london',
    });
  });
});

describe('the map chooses the target of an event', () => {
  const board = (view: PandemicView) =>
    render(<Board view={view} presence={null} connection="online" rematch={rematch} />);

  it('sends an Airlift to the city that is tapped, on the pawn chosen', () => {
    usePandemic.getState().planEvent({ event: 'airlift', owner: 'p2', pawn: 'p3' });
    const { container } = board(seen(game('airlift'), 'p2'));
    fireEvent.click(container.querySelector('[data-city="tokyo"]')!);
    expect(send).toHaveBeenCalledWith({
      type: 'play-event',
      event: 'airlift',
      pawn: 'p3',
      to: 'tokyo',
    });
    expect(usePandemic.getState().eventPlan).toBeNull();
  });

  it('does not send a city the card cannot go to', () => {
    usePandemic.getState().planEvent({ event: 'airlift', owner: 'p2', pawn: 'p3' });
    const { container } = board(seen(game('airlift'), 'p2'));
    fireEvent.click(container.querySelector('[data-city="atlanta"]')!);
    expect(send).not.toHaveBeenCalled();
    expect(usePandemic.getState().eventPlan).not.toBeNull();
  });

  it('builds a Government Grant station in the tapped city when there is room', () => {
    usePandemic.getState().planEvent({ event: 'government-grant', owner: 'p2', city: null });
    const { container } = board(seen(game('government-grant'), 'p2'));
    fireEvent.click(container.querySelector('[data-city="tokyo"]')!);
    expect(send).toHaveBeenCalledWith({
      type: 'play-event',
      event: 'government-grant',
      city: 'tokyo',
    });
  });

  it('asks for the station to move first when all 6 are built', () => {
    const g = game('government-grant');
    g.stations = ['atlanta', 'paris', 'london', 'essen', 'milan', 'chicago'];
    usePandemic.getState().planEvent({ event: 'government-grant', owner: 'p2', city: null });
    const { container } = board(seen(g, 'p2'));
    fireEvent.click(container.querySelector('[data-city="tokyo"]')!);
    expect(send).not.toHaveBeenCalled();
    expect(usePandemic.getState().eventPlan).toEqual({
      event: 'government-grant',
      owner: 'p2',
      city: 'tokyo',
    });
  });
});

describe('Forecast', () => {
  /** p2 has played Forecast: the top 6 cards wait for the new order. */
  function arranging(): GameState {
    const g = game();
    g.infectionDeck = ['tokyo', 'osaka', 'seoul', 'paris', 'london', 'essen', 'milan'];
    g.pending = {
      kind: 'forecast',
      seat: 'p2',
      count: 6,
      cards: ['tokyo', 'osaka', 'seoul', 'paris', 'london', 'essen'],
    };
    return g;
  }

  it('opens a dialog for the player arranging the cards only', () => {
    const { rerender, container } = render(<ForecastDialog view={seen(arranging(), 'p1')} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ForecastDialog view={seen(arranging(), 'spectator')} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ForecastDialog view={seen(arranging(), 'p2')} />);
    expect(screen.getByRole('dialog', { name: 'Forecast' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('moves a card with the arrows and sends the order that was chosen', () => {
    render(<ForecastDialog view={seen(arranging(), 'p2')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Move Tokyo down' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Essen up' }));
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toContain('Osaka');
    expect(items[1]).toContain('Tokyo');
    fireEvent.click(screen.getByRole('button', { name: 'Keep this order' }));
    expect(send).toHaveBeenCalledWith({
      type: 'forecast-order',
      cards: ['osaka', 'tokyo', 'seoul', 'paris', 'essen', 'london'],
    });
  });

  it('reorders by dragging a card onto another', () => {
    render(<ForecastDialog view={seen(arranging(), 'p2')} />);
    const items = screen.getAllByRole('listitem');
    fireEvent.dragStart(items[0]!);
    fireEvent.dragOver(items[2]!);
    fireEvent.drop(items[2]!);
    expect(screen.getAllByRole('listitem')[2]).toHaveTextContent('Tokyo');
  });

  it('keeps the first card from moving up and the last from moving down', () => {
    render(<ForecastDialog view={seen(arranging(), 'p2')} />);
    expect(screen.getByRole('button', { name: 'Move Tokyo up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Essen down' })).toBeDisabled();
  });

  it('tells the others how many cards are being arranged, without the cards', () => {
    render(<Prompts view={seen(arranging(), 'p1')} presence={null} />);
    expect(screen.getByText('p2 is arranging the top 6 infection cards.')).toBeInTheDocument();
    expect(screen.queryByText('Tokyo')).toBeNull();
  });
});
