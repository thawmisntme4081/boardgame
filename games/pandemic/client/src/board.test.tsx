import { CITIES, createGame, viewFor, type CityId, type PandemicView } from '@pandemic/rules';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Board } from './Board';
import { MapPieces } from './components/MapPieces';
import { MapTracks } from './components/MapTracks';
import { WorldMap } from './components/WorldMap';
import { infectionCardUrl, playerCardUrl } from './lib/cardImages';
import { PAWN_WIDTH } from './svgs/Pawn';
import { OUTBREAK_SLOTS, INFECTION_SLOTS, cityPoint } from './lib/mapGeometry';

const noCubes = { blue: 0, yellow: 0, black: 0, red: 0 };

/** A dealt 3-player game as seat p1 sees it; tests change the fields they care about. */
function fixture(): PandemicView {
  const game = createGame({ seats: ['p1', 'p2', 'p3'], epidemics: 4, seed: 1 });
  const view = structuredClone(viewFor(game, 'p1'));
  // The deal puts cubes on the board: start from an empty map, so a test sees only its own pieces.
  for (const { id } of CITIES) view.cubes[id] = { ...noCubes };
  view.stations = [];
  return view;
}

/** The map's pieces are drawn inside the map's <svg>, as in the board. */
const inMap = (node: React.ReactNode) => <svg>{node}</svg>;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Pandemic 03: the world map (task 1)', () => {
  it('draws every city of the game, once', () => {
    const { container } = render(<WorldMap />);
    const drawn = [...container.querySelectorAll('[data-city]')].map((el) =>
      el.getAttribute('data-city'),
    );
    expect(drawn).toHaveLength(48);
    expect(new Set(drawn)).toEqual(new Set(CITIES.map((c) => c.id)));
  });

  it('gives every city a position on the picture, apart from the others', () => {
    const spots = new Set(CITIES.map(({ id }) => JSON.stringify(cityPoint(id))));
    expect(spots.size).toBe(48);
    for (const { id } of CITIES) {
      const { x, y } = cityPoint(id);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(950);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(690);
    }
  });

  it('reports the city that was tapped, and marks the selected and reachable ones', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <WorldMap onSelect={onSelect} selected="paris" reachable={new Set<CityId>(['london'])} />,
    );
    fireEvent.click(container.querySelector('[data-city="tokyo"]')!);
    expect(onSelect).toHaveBeenCalledWith('tokyo');
    expect(container.querySelector('[data-city="paris"] circle[stroke="white"]')).not.toBeNull();
    expect(
      container.querySelector('[data-city="london"] circle[stroke="oklch(0.85 0.17 95)"]'),
    ).not.toBeNull();
  });

  it('draws a cure marker for each cured disease only', () => {
    const { container } = render(
      <WorldMap cures={{ blue: 'cured', yellow: 'none', black: 'eradicated', red: 'none' }} />,
    );
    expect(
      [...container.querySelectorAll('[data-cure]')].map((el) => el.getAttribute('data-cure')),
    ).toEqual(['blue', 'black']);
  });
});

describe('Pandemic 03: cubes, stations and pawns (task 2)', () => {
  it('draws one cube for each cube on the map, in its color', () => {
    const view = fixture();
    view.cubes.atlanta = { ...noCubes, blue: 2, red: 1 };
    view.cubes.tokyo = { ...noCubes, black: 3 };
    const { container } = render(inMap(<MapPieces view={view} presence={null} />));
    const count = (color: string) => container.querySelectorAll(`[data-cube="${color}"]`).length;
    expect(count('blue')).toBe(2);
    expect(count('red')).toBe(1);
    expect(count('black')).toBe(3);
    expect(count('yellow')).toBe(0);
    for (const el of container.querySelectorAll('[data-cube]')) {
      expect(el.querySelectorAll('path')).toHaveLength(6);
    }
  });

  it('draws a research station in each city that has one', () => {
    const view = fixture();
    view.stations = ['atlanta', 'tokyo'];
    const { container } = render(inMap(<MapPieces view={view} presence={null} />));
    expect(
      [...container.querySelectorAll('[data-station]')].map((el) =>
        el.getAttribute('data-station'),
      ),
    ).toEqual(['atlanta', 'tokyo']);
  });

  it('draws one pawn for each seated player, named after the player', () => {
    const view = fixture();
    const { container } = render(
      inMap(
        <MapPieces
          view={view}
          presence={{
            p1: { name: 'Ana', online: true, creator: true },
            p2: { name: 'Ben', online: true, creator: false },
            p3: { name: 'Cleo', online: true, creator: false },
          }}
        />,
      ),
    );
    const pawns = [...container.querySelectorAll('[data-pawn]')];
    expect(pawns.map((el) => el.getAttribute('data-pawn')).sort()).toEqual(['p1', 'p2', 'p3']);
    expect(container.querySelector('[data-pawn="p2"] title')?.textContent).toBe('Ben');
  });

  it('stacks the pawns of a city side by side, centered on it, the lowest seat on top', () => {
    const view = fixture();
    view.pawns = { p1: 'atlanta', p2: 'atlanta', p3: 'atlanta' };
    const { container } = render(inMap(<MapPieces view={view} presence={null} />));
    const groups = [...container.querySelectorAll<SVGGElement>('g[style*="translate"]')];
    const xs = groups.map((g) => Number(/translate\(([-\d.]+)px/.exec(g.style.transform)![1]));
    // Drawn from seat 3 to seat 1 (the last drawn is on top), each one step further left.
    expect(xs).toEqual([...xs].sort((a, b) => b - a));
    expect(new Set(xs).size).toBe(3);
    const center = (xs[0]! + xs[2]!) / 2 + PAWN_WIDTH / 2;
    expect(Math.abs(center - cityPoint('atlanta').x)).toBeLessThan(0.01);
  });

  it('keeps a treated cube on screen for a moment to shrink away, then removes it', () => {
    const view = fixture();
    view.cubes.paris = { ...noCubes, blue: 2 };
    const { container, rerender } = render(inMap(<MapPieces view={view} presence={null} />));
    expect(container.querySelectorAll('[data-cube]')).toHaveLength(2);

    const after = structuredClone(view);
    after.cubes.paris = { ...noCubes, blue: 1 };
    rerender(inMap(<MapPieces view={after} presence={null} />));
    expect(container.querySelectorAll('[data-cube]')).toHaveLength(2);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(container.querySelectorAll('[data-cube]')).toHaveLength(1);
  });
});

describe('Pandemic 03: tracks, decks and piles (task 3)', () => {
  it('puts the markers on the track spaces of the current counts', () => {
    const view = fixture();
    view.outbreaks = 3;
    view.infectionRate = 4;
    const { container } = render(inMap(<MapTracks view={view} />));
    const spot = (selector: string) =>
      /translate\(([-\d.]+)px, ([-\d.]+)px\)/
        .exec(
          container
            .querySelector(selector)!
            .closest('g[style*="translate"]')!
            .getAttribute('style')!,
        )!
        .slice(1, 3)
        .map(Number);
    expect(spot('[data-outbreaks="3"]')).toEqual([OUTBREAK_SLOTS[3]!.x, OUTBREAK_SLOTS[3]!.y]);
    expect(spot('[data-infection-rate="4"]')).toEqual([
      INFECTION_SLOTS[4]!.x,
      INFECTION_SLOTS[4]!.y,
    ]);
  });

  it('has a space on the track for every count, up to the skull and the last rate', () => {
    expect(OUTBREAK_SLOTS).toHaveLength(9);
    expect(INFECTION_SLOTS).toHaveLength(7);
    const view = fixture();
    view.outbreaks = 8;
    view.infectionRate = 6;
    const { container } = render(inMap(<MapTracks view={view} />));
    expect(container.querySelector('[data-outbreaks="8"]')).not.toBeNull();
    expect(container.querySelector('[data-infection-rate="6"]')).not.toBeNull();
  });

  it('shows the cubes left of each disease and the research stations left', () => {
    const view = fixture();
    view.supply = { blue: 19, yellow: 18, black: 21, red: 20 };
    view.stations = ['atlanta', 'paris'];
    const { container } = render(inMap(<MapTracks view={view} />));
    const text = (key: string) =>
      container.querySelector(`[data-supply="${key}"] text`)?.firstChild?.textContent;
    expect(text('blue')).toBe('19');
    expect(text('yellow')).toBe('18');
    expect(text('black')).toBe('21');
    expect(text('red')).toBe('20');
    expect(text('stations')).toBe('4');
  });

  it('shows the deck sizes, and the top card of each discard pile', () => {
    const view = fixture();
    view.playerDeckSize = 31;
    view.infectionDeckSize = 39;
    view.infectionDiscard = ['paris', 'lima', 'cairo'];
    view.playerDiscard = [
      { kind: 'city', city: 'tokyo' },
      { kind: 'event', event: 'airlift' },
    ];
    const { container } = render(inMap(<MapTracks view={view} />));
    const pile = (label: RegExp) =>
      [...container.querySelectorAll('[data-pile]')].find((el) =>
        label.test(el.getAttribute('data-pile') ?? ''),
      )!;
    expect(pile(/Player deck/).querySelector('text')?.firstChild?.textContent).toBe('31');
    expect(pile(/Infection deck/).querySelector('text')?.firstChild?.textContent).toBe('39');
    expect(
      pile(/Infection discard/)
        .querySelector('image')
        ?.getAttribute('href'),
    ).toBe(infectionCardUrl('cairo'));
    expect(
      pile(/Player discard/)
        .querySelector('image')
        ?.getAttribute('href'),
    ).toBe(playerCardUrl({ kind: 'event', event: 'airlift' }));
  });

  it('shows no card in an empty pile', () => {
    const view = fixture();
    view.infectionDiscard = [];
    view.playerDiscard = [];
    const { container } = render(inMap(<MapTracks view={view} />));
    const discard = [...container.querySelectorAll('[data-pile]')].filter((el) =>
      /discard/.test(el.getAttribute('data-pile') ?? ''),
    );
    expect(discard).toHaveLength(2);
    for (const el of discard) expect(el.querySelector('image')).toBeNull();
  });

  it('has a different picture for each city card, and for each event', () => {
    const infection = new Set(CITIES.map(({ id }) => infectionCardUrl(id)));
    const player = new Set(CITIES.map(({ id }) => playerCardUrl({ kind: 'city', city: id })));
    expect(infection.size).toBe(48);
    expect(player.size).toBe(48);
    const events = (
      [
        'airlift',
        'forecast',
        'government-grant',
        'one-quiet-night',
        'resilient-population',
      ] as const
    ).map((event) => playerCardUrl({ kind: 'event', event }));
    expect(new Set(events).size).toBe(5);
  });
});

describe('Pandemic 03: moves are animated', () => {
  const animate = () => vi.mocked(Element.prototype.animate);

  it('a pawn that changes city hops there; one that stays put does not animate', () => {
    const view = fixture();
    view.pawns = { p1: 'atlanta', p2: 'chicago', p3: 'paris' };
    const { rerender } = render(inMap(<MapPieces view={view} presence={null} />));
    animate().mockClear();

    rerender(inMap(<MapPieces view={view} presence={null} />));
    expect(animate()).not.toHaveBeenCalled();

    const moved = structuredClone(view);
    moved.pawns = { ...view.pawns, p1: 'tokyo' };
    rerender(inMap(<MapPieces view={moved} presence={null} />));
    // A move to another city takes longer than a slide within a city's stack (350 ms).
    const hop = animate().mock.calls.find(
      ([, options]) => ((options as KeyframeAnimationOptions).duration as number) > 350,
    );
    expect(hop).toBeDefined();
  });

  it('the outbreak and infection markers hop and turn when their counts change', () => {
    const view = fixture();
    view.outbreaks = 2;
    view.infectionRate = 3;
    const { rerender } = render(inMap(<MapTracks view={view} />));
    animate().mockClear();

    const next = structuredClone(view);
    next.outbreaks = 3;
    next.infectionRate = 4;
    rerender(inMap(<MapTracks view={next} />));
    // Each marker: one animation for its path, one for its turn.
    expect(animate()).toHaveBeenCalledTimes(4);
  });
});

describe('Pandemic 03: the desktop layout (task 4)', () => {
  it('fills one window without scrolling the page, with the map, hands and actions in it', () => {
    const view = fixture();
    const { container } = render(
      <Board
        view={view}
        presence={null}
        connection="online"
        rematch={{ by: null, config: null, accepted: [] }}
      />,
    );
    const main = container.querySelector('main')!;
    expect(main.className).toContain('h-dvh');
    expect(main.className).toContain('overflow-hidden');
    expect(main.querySelector('svg[aria-label="Map"]')).not.toBeNull();
    expect(screen.getByRole('region', { name: 'Hands' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Actions' })).toBeInTheDocument();
  });

  it('shows nothing while the table waits for players', () => {
    const { container } = render(
      <Board
        view={{ status: 'waiting', you: 'p1', seated: ['p1'], players: 3, epidemics: 4 }}
        presence={null}
        connection="online"
        rematch={{ by: null, config: null, accepted: [] }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
