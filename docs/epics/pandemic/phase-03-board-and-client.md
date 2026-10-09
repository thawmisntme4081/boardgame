# Pandemic 03: Board and client

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ✅ Done** · Effort: **high**

Needs [Pandemic 02](phase-02-walking-skeleton.md). Custom components (Tailwind + SVG) for the board; shadcn only for dialogs, toasts, popovers.

## Goals

- The real board replacing the skeleton: a world map players act on directly, on desktop only (Pandemic is not built for phones or tablets: no responsive layout).

## Feature scope

- **In:** an SVG world map (cities, links, Pacific links at the edges, cubes, stations, pawns), tracks (outbreaks, infection rate, cures and eradications, cube supply), deck counts and discard piles; no pan or pinch-zoom; hands; acting from the map with legal targets highlighted by `canActInView`; prompts (share, hand limit); a turn and infection log; the game-over dialog with "Play again"; server error codes as toasts (`errorText`).
- **Out:** role and event controls (04, 05); setup choices and history (06).

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with typecheck, lint and format passing; tests are written and run at the end of the phase, after your review.

**Map (read only)**

- [x] 1. **M** `WorldMap` SVG on `assets/map.webp` (a board picture that already draws the links, the city icons, the outbreak and infection rate tracks, the two deck frames and the cure slots): a position for each city (`lib/mapGeometry.ts`), name labels, round targets for taps and highlights; a test that every city of `cities.ts` is drawn.
- [x] 2. **M** Cubes, research stations and pawns on the map, from fixed views (React Testing Library).
- [x] 3. **L** Tracks on the picture's own slots (outbreak marker, infection rate marker, cure vials, cube supply), deck counts and both discard piles in its two frames.
- [x] 4. **M** Desktop layout: the map in the middle, tracks and decks on one side, the hands below (one centered container, max 90rem), everything in the window with no page scroll; no phone or tablet layout.

**Playing**

- [x] 5. **L** Hands tray: your hand and the others' (collapsed to save space), cards by color.
- [x] 6. **M** Moving: tap a city, see the legal ways to get there (drive, direct, charter, shuttle), confirm.
- [x] 7. **M** Treat, Build, Cure (choosing the 5 cards) and Pass, with the actions-left counter.
- [x] 8. **M** Prompts: the share offer and its answer, the hand-limit discard, also for a player outside their turn.
- [x] 9a. **M** Rules: a `log` in the state and `viewFor` (cards drawn, epidemics, cities infected, outbreaks and their chain; current and previous turn).
- [x] 9b. **M** Draw and Infect buttons, the epidemic shown step by step, and the turn and infection log panel.
- [x] 10. **L** Game-over dialog (won, or lost with its reason) with "Play again" (N-player rematch); error toasts; the skeleton board removed.

**Checks**

- [x] 11. **M** Playwright: the 3-player game from phase 02 played through the real board on Desktop Chrome.

## Checklist

- [x] Map, tracks and hands drawn from a view
- [x] Every base action, prompt and step reachable from the board; highlights only from `canActInView`
- [x] Desktop layout checked
- [x] Playwright passes on Desktop Chrome (Pandemic is desktop only: no iPhone or Pixel runs)

## Open questions

- None.

**Done when:** three players finish a basic game on desktop (Playwright, Desktop Chrome).

✅ Verified (2026-10-10): the user reviewed the board on desktop. `pnpm test` passes (59 files, 720 tests); `pnpm e2e` passes on Desktop Chrome (the three-player win with the game-over dialog and "Play again", and a turn played through the buttons; the iPhone profile is skipped, as Pandemic is desktop only). Typecheck, lint, format:check and build pass. Deviations: the reduced-motion guard was removed from the animations, and its test with it; the Pandemic rules tests have a 30 s timeout under the full run.
