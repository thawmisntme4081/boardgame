# Pandemic 01: Rules core

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **high**

Needs the [Platform epic](../platform/EPIC.md). Design reference: [multi-game proposal](../../proposals/multi-game-platform.md), section 2. Copy the layout of `games/sky-team/rules`. No UI in this phase.

## Goals

- The base game's rules, without roles and events, as pure functions in `games/pandemic/rules` (`@pandemic/rules`), and its `GameDefinition` passing the engine test kit.

## Feature scope

- **In:** the 48 cities; seeded setup for 2–4 players; the 8 actions (Drive / Ferry, Direct, Charter and Shuttle Flight, Build a Research Station, Treat Disease, Share Knowledge, Discover a Cure) and Pass, 4 per turn; drawing 2 player cards, the hand limit of 7, epidemics, infecting, outbreaks and chain reactions, eradication; winning (4 cures) and the three losses (8 outbreaks, no cubes, no player cards); `pandemic`, the game's `GameDefinition` (imported only as `@pandemic/rules/definition`); views that never hold a deck order or the seed.
- **Out:** roles (04) and events (05) beyond their ids; lobby options beyond the number of players (06); any UI (02, 03).

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with its tests passing.

**Package and data**

- [ ] 1. **L** Scaffold `games/pandemic/rules` (package.json, tsconfig, Vitest project, workspace entry); no dependency on the server or the web packages.
- [ ] 2. **M** `cities.ts`: the 48 cities with colour, population, connections (Pacific links included) and map position; tests that links are symmetric, 12 cities per colour, every city reachable.
- [ ] 3. **L** `types.ts`: `GameState` (cubes per city, stations, pawns, hands, player deck and discard, infection deck and discard, outbreak and infection-rate tracks, cures, cube supply, active seat, actions left, turn step); card ids; role and event ids as constants (no behaviour yet).
- [ ] 4. **M** `createGame({ seats, epidemics, seed })` with `nextRandom` from `@platform/engine`: station in Atlanta, 9 infection cards (3 / 2 / 1 cubes), hands of 4 / 3 / 2 cards for 2 / 3 / 4 players, epidemics shuffled into equal piles; tests on fixed seeds.

**Actions**

- [ ] 5. **L** `checkAction(state, seat, action)` returning a reason code (`not-your-turn`, `no-actions-left`, `not-adjacent`, `card-missing`, …) and the 4-actions counter; Pass.
- [ ] 6. **M** Movement: Drive / Ferry, Direct, Charter and Shuttle Flight, with their discards.
- [ ] 7. **L** Build a Research Station (at most 6; moving one when all are placed), Treat Disease, eradication.
- [ ] 8. **M** Share Knowledge as `share-offer` and `share-accept` / `share-decline`; a receiver over 7 cards owes a discard.
- [ ] 9. **L** Discover a Cure (5 cards of one colour at a station); a fast-check property: cubes on the map plus the supply always equal the starting total per colour.

**Draw and infect**

- [ ] 10. **M** Turn steps `actions` → `draw` → `infect` as explicit moves by the active player; drawing 2 cards; the hand limit as a pending `discard` that blocks play until done, even for a player outside their turn.
- [ ] 11. **M** `infectCity` with outbreaks and chains (a city outbreaks once per chain; eradicated colours place nothing); tests on hand-made chains, a loop of three cities included.
- [ ] 12. **M** Epidemic: increase the rate, infect the bottom card with 3 cubes, pause, intensify; two epidemics in one draw; the infect step with the infection rate (2, 2, 2, 3, 3, 4, 4).
- [ ] 13. **L** `outcome(state)`: won, or lost with a reason code (`outbreaks`, `cubes`, `player-deck`); one scripted game per ending.

**Engine adapter**

- [ ] 14. **M** `definition.ts`: `meta` (seats `p1`–`p4`, 2–4 players, `coop`), `configSchema` (`players`, `epidemics`), `moveSchema`, `setup`, `actors` (the active seat as `turn`; a seat owing a discard or answering a share as `prompt`), `validate`, `apply`, `outcome`, `started`.
- [ ] 15. **M** `view`: hands are open, decks only as counts, both discard piles shown; tests that no view holds a deck order, a pile split or the seed.
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

- Edition: base game, 4th edition city list and map assumed. Assumption (to confirm).
- Share Knowledge online: an offer the receiver accepts, cancelled by any other action of the active player. Assumption (to confirm).
- "Draw" and "Infect" as explicit moves of the active player (gives other players a moment to play events, phase 05) rather than automatic. Assumption (to confirm).
- The epidemic pauses between Infect and Intensify (for Resilient Population, phase 05); the active player continues with one move. Assumption (to confirm).

**Done when:** `definition.test.ts` passes the engine kit for 2–4 seats, random games reach every ending, and nothing outside `games/pandemic` changed except the workspace config.
