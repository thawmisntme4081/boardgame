# Pandemic 01: Rules core

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **high**

Needs the [Platform epic](../platform/EPIC.md). Design reference: [multi-game proposal](../../proposals/multi-game-platform.md), section 2. Copy the layout of `games/sky-team/rules`. No UI in this phase.

## Goals

- The base game's rules, without roles and events, as pure functions in `games/pandemic/rules` (`@pandemic/rules`), and its `GameDefinition` passing the engine test kit.

## Feature scope

- **In:** the 48 cities; seeded setup for 2–4 players, with a random turn order kept for the whole game; the 8 actions (Drive / Ferry, Direct, Charter and Shuttle Flight, Build a Research Station, Treat Disease, Share Knowledge, Discover a Cure) and Pass, 4 per turn; drawing 2 player cards, the hand limit of 7, epidemics, infecting, outbreaks and chain reactions, eradication; winning (4 cures) and the three losses (8 outbreaks, no cubes, no player cards); `pandemic`, the game's `GameDefinition` (imported only as `@pandemic/rules/definition`); views that never hold a deck order or the seed.
- **Out:** roles (04) and events (05) beyond their ids; lobby options beyond the number of players (06); any UI (02, 03).

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with its tests passing.

**Package and data**

- [x] 1. **L** Scaffold `games/pandemic/rules` (package.json, tsconfig, Vitest project, workspace entry); no dependency on the server or the web packages.
- [x] 2. **M** `cities.ts`: the 48 cities with color, connections (Pacific links included) and map position; tests that links are symmetric, 12 cities per color, every city reachable. Written from the standard board (the rulebook's text has none of it), then checked by the user against the physical board and cards.
- [x] 3. **L** `types.ts`: `GameState` (cubes per city, stations, pawns, hands, player deck and discard, infection deck and discard, outbreak and infection-rate tracks, cures, cube supply, active seat, actions left, turn step); card ids; role and event ids as constants (no behavior yet).
- [x] 4. **M** `createGame({ seats, epidemics, seed })` with `nextRandom` from `@platform/engine`: station in Atlanta, 9 infection cards (3 / 2 / 1 cubes), hands of 4 / 3 / 2 cards for 2 / 3 / 4 players, epidemics shuffled into equal piles, a random turn order; tests on fixed seeds.

**Actions**

- [x] 5. **L** `checkAction(state, seat, action)` returning a reason code (`not-your-turn`, `no-actions-left`, `not-adjacent`, `card-missing`, …) and the 4-actions counter; Pass.
- [x] 6. **M** Movement: Drive / Ferry, Direct, Charter and Shuttle Flight, with their discards.
- [x] 7. **L** Build a Research Station (at most 6; moving one when all are placed), Treat Disease, eradication.
- [x] 8. **M** Share Knowledge (give or take) as `share-offer` by the active player, then `share-accept` / `share-decline` by the partner or `share-cancel` by the active player; the action is spent only when accepted; while an offer is open the active player can only cancel it; a receiver over 7 cards owes a discard. No undo for any action.
- [x] 9. **L** Discover a Cure (5 cards of one color at a station); a fast-check property: cubes on the map plus the supply always equal the starting total per color.

**Draw and infect**

- [ ] 10. **M** Turn steps `actions` → `draw` → `infect`, one move per card as at the table: `draw` (both cards), then each epidemic step and each infection card flipped by its own move of the active player; drawing 2 cards; the hand limit as a pending `discard` that blocks play until done, even for a player outside their turn.
- [ ] 11. **M** `infectCity` with outbreaks and chains (a city outbreaks once per chain; chain reactions first in, first out, neighbors in the city list's order; eradicated colors place nothing); tests on hand-made chains, a loop of three cities included.
- [ ] 12. **M** Epidemic: increase the rate, infect the bottom card with 3 cubes, pause, intensify; two epidemics in one draw, with a pause between them; the infect step with the infection rate (2, 2, 2, 3, 3, 4, 4).
- [ ] 13. **L** `outcome(state)`: won, or lost with a reason code (`outbreaks`, `cubes`, `player-deck`); one scripted game per ending.

**Engine adapter**

- [ ] 14. **M** `definition.ts`: `meta` (seats `p1`–`p4`, 2–4 players, `coop`), `configSchema` (`players`, `epidemics`), `moveSchema`, `setup`, `actors` (the active seat as `turn`; a seat owing a discard or answering a share as `prompt`), `validate`, `apply`, `outcome`, `started`.
- [ ] 15. **M** `view`: hands are open to everyone at every difficulty, decks only as counts, both discard piles shown; tests that no view holds a deck order, a pile split or the seed.
- [ ] 16. **M** `definition.test.ts` running the engine kit (`checkGame`, `checkReplay`) for 2, 3 and 4 seats; `random-play.ts` and the `pnpm --filter @pandemic/rules random-play` script.
- [ ] 17. **L** `canActInView(view, seat, action)`: the same checks on a view, for the client's highlights; a test that it agrees with `validate` on random states.

## Checklist

- [ ] City data and setup tests pass for 2, 3 and 4 players and 4, 5, 6 epidemics
- [ ] Every action, the draw, the infect step and epidemics tested, legal and illegal cases
- [ ] The win and the three losses tested
- [ ] Engine kit passes; 1000 random games end without an error
- [ ] View tests: no deck order, no seed
- [ ] Open questions listed below

## Open questions

The spec is `docs/rulebooks/pandemic_rules.pdf` (Z-Man, 2013 edition, © 2015 printing: 48 cities, 5 events, 7 roles incl. Contingency Planner and Quarantine Specialist).

- None yet.

**Done when:** `definition.test.ts` passes the engine kit for 2–4 seats, random games reach every ending, and nothing outside `games/pandemic` changed except the workspace config.
