# Pandemic 03: Board and client

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **high**

Needs [Pandemic 02](phase-02-walking-skeleton.md). Custom components (Tailwind + SVG) for the board; shadcn only for dialogs, toasts, popovers.

## Goals

- The real board replacing the skeleton: a world map players act on directly, on desktop only (Pandemic is not built for phones or tablets: no responsive layout).

## Feature scope

- **In:** an SVG world map (cities, links, Pacific links at the edges, cubes, stations, pawns), tracks (outbreaks, infection rate, cures and eradications, cube supply), deck counts and discard piles; no pan or pinch-zoom; hands; acting from the map with legal targets highlighted by `canActInView`; prompts (share, hand limit); a turn and infection log; the game-over dialog with "Play again"; server error codes as toasts (`errorText`).
- **Out:** role and event controls (04, 05); setup choices and history (06).

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with typecheck, lint and format passing; tests are written and run at the end of the phase, after your review.

**Map (read only)**

- [ ] 1. **M** `WorldMap` SVG: cities, links, labels; a test that every city of `cities.ts` is drawn.
- [ ] 2. **M** Cubes, research stations and pawns on the map, from fixed views (React Testing Library).
- [ ] 3. **L** Tracks panel, deck counts, both discard piles.
- [ ] 4. **M** Desktop layout: the map in the middle, tracks and decks on one side, the hands below (one centered container, max 90rem), everything in the window with no page scroll; no phone or tablet layout.

**Playing**

- [ ] 5. **L** Hands tray: your hand and the others' (collapsed to save space), cards by color.
- [ ] 6. **M** Moving: tap a city, see the legal ways to get there (drive, direct, charter, shuttle), confirm.
- [ ] 7. **M** Treat, Build, Cure (choosing the 5 cards) and Pass, with the actions-left counter.
- [ ] 8. **M** Prompts: the share offer and its answer, the hand-limit discard, also for a player outside their turn.
- [ ] 9a. **M** Rules: a `log` in the state and `viewFor` (cards drawn, epidemics, cities infected, outbreaks and their chain; current and previous turn).
- [ ] 9b. **M** Draw and Infect buttons, the epidemic shown step by step, and the turn and infection log panel.
- [ ] 10. **L** Game-over dialog (won, or lost with its reason) with "Play again" (N-player rematch); error toasts; the skeleton board removed.

**Checks**

- [ ] 11. **M** Playwright: the 3-player game from phase 02 played through the real board on Desktop Chrome.

## Checklist

- [ ] Map, tracks and hands drawn from a view
- [ ] Every base action, prompt and step reachable from the board; highlights only from `canActInView`
- [ ] Desktop layout checked
- [ ] Playwright passes on Desktop Chrome (Pandemic is desktop only: no iPhone or Pixel runs)

## Open questions

All settled with the user:

1. **Map picture (task 1).** `assets/map.webp` (1506 × 703) is a bare world map, and the city positions in `cities.ts` are fractions of it. Decided: the SVG uses it as an `<image>` with `viewBox="0 0 1506 703"` and draws cities, links, labels and pieces on top; no hand-drawn continents. The pictures in `assets/` are used as they are; city cards are the `city-*.webp` files.
2. **Turn and infection log (task 9).** The view has no history, only the current state. Decided: the rules add a short `log` (events of the current and previous turn: cards drawn, epidemics, cities infected, outbreaks and their chain) to the state and copy it in `viewFor`, rather than deriving it in the client (lost on reload, and an outbreak chain cannot be told apart). Pandemic is not deployed, so no stored match needs a `migrate`. Task 9 is done in two parts: 9a the rules `log`, 9b the UI.
3. **Moving (task 6).** Decided: tapping a city opens a small popover with each legal way to get there and its cost ("Direct flight: discard Paris"); choosing one sends the move, with no extra confirm step. Cities you can reach are highlighted only while it is your action step.
4. **Page width (task 4).** Decided: Pandemic's board may use a wider container (max 90rem) so the map stays readable, and the whole board (map, tracks, decks, hands, prompts, log) fits in the window on a desktop screen: players never scroll the page. Panels that can grow (the log, discard piles, other players' hands) scroll or collapse inside their own box. Below 1024 px there is no other layout.
5. **Event cards in hand (before phase 05).** Decided: shown in the hand and selectable for the hand-limit discard, but not playable until phase 05.
6. **Pawns (before phase 04).** Decided: one color per seat (p1–p4) until roles give each pawn its role color. The pawn is an SVG component the user provides (task 2 uses a placeholder until it arrives).

**Done when:** three players finish a basic game on desktop (Playwright, Desktop Chrome).
