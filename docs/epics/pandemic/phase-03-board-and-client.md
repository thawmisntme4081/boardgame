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
- [ ] 4. **M** Desktop layout: the map in the middle, tracks and decks on one side, the hands below (one centered container, max 72rem); no phone or tablet layout.

**Playing**

- [ ] 5. **L** Hands tray: your hand and the others' (collapsed to save space), cards by color.
- [ ] 6. **M** Moving: tap a city, see the legal ways to get there (drive, direct, charter, shuttle), confirm.
- [ ] 7. **M** Treat, Build, Cure (choosing the 5 cards) and Pass, with the actions-left counter.
- [ ] 8. **M** Prompts: the share offer and its answer, the hand-limit discard, also for a player outside their turn.
- [ ] 9. **M** Draw and Infect buttons, the epidemic shown step by step, and a turn and infection log (cards drawn, cities infected, outbreaks).
- [ ] 10. **L** Game-over dialog (won, or lost with its reason) with "Play again" (N-player rematch); error toasts; the skeleton board removed.

**Checks**

- [ ] 11. **M** Playwright: the 3-player game from phase 02 played through the real board on Desktop Chrome.

## Checklist

- [ ] Map, tracks and hands drawn from a view
- [ ] Every base action, prompt and step reachable from the board; highlights only from `canActInView`
- [ ] Desktop layout checked
- [ ] Playwright passes on the three device profiles

**Done when:** three players finish a basic game on desktop (Playwright, Desktop Chrome).
