# Pandemic 06: Setup and variants

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: 🚧 In progress** · Effort: **medium**

Needs [Pandemic 05](phase-05-events.md).

## Goals

- Everything chosen before the first turn. Ends with the epic's check: 2–4 players finish a game on desktop.

## Feature scope

- **In:** difficulty (introductory 4, standard 5, heroic 6 epidemics) in the lobby; roles dealt at random or chosen in a "before the game" step before the board is dealt (each player picks a free role, then everyone confirms, like Sky Team's `crew`); a random turn order drawn when that step starts and shown in it; a rematch keeps the players, difficulty and role mode, with a new turn order. The deal is shown step by step: once everyone has confirmed, the client plays the setup back (station and pawns, the starting infections, the hands, the player deck built in its epidemic piles) with animations, then play begins; the server still deals at once (presentation only, no rule change).
- **Out (decided with the user):** a Flight Log for Pandemic: no record, no History section, no guest copy.

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with typecheck, lint and format passing; tests are written and run at the end of the phase, after your review.

**Rules**

- [x] 1. **L** Lobby schema and `configSchema` with `epidemics` and a role mode (random / choose); the server refuses a bad config.
- [x] 2. **M** A "before the game" step (before the deal) with `pick-role` and `confirm` moves; the turn order drawn when it starts, roles dealt at random in random mode; the board dealt once everyone has confirmed.
- [x] 3. **L** `setup.previous` for a rematch (same players, difficulty and role mode, a new random turn order; in choose mode everyone picks again).

**Client**

- [x] 4. **M** `SetupForm` (players, difficulty, role mode) and the "before the game" panel (turn order, roles or the role to pick, confirm).

**Checks**

- [x] 5. **M** Playwright: a full 3-player game on Desktop Chrome, played to its end by passing every turn; 2- and 4-player smoke tests from prepared positions.
**Deal animation** (added after task 5)

- [x] 6. **M** Deal playback: when a view turns from the "before the game" step to the dealt game in this session, the board shows a display view that starts empty and fills step by step on a timeline (like Sky Team's "Next turn" pause); the actions stay off meanwhile; reduced motion (the browser setting) jumps to the dealt board; a reload or reconnect mid-game shows the board at once.
- [x] 7. **M** The steps on the board with the existing animations: the Atlanta station and the pawns, each starting infection (its card flies from the infection deck to the discard pile, then its cubes appear), the hands dealt card by card in turn order, the player deck built (the cards left split face down into one pile per epidemic card, an Epidemic card shuffled into each, the piles stacked back, larger on top; card backs only), then the first player's turn; the "no animation on the first view" rule of the hand and the infection pile gives way to the deal.
- [ ] 8. **M** Playwright: a new game plays its deal and the board ends as dealt (the actions only then), a reload during play shows the board at once.

**Final check**

- [ ] 9. **M** Write the phase's tests (deal playback included) and run the full suite: `pnpm test`, `pnpm e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (after your review of the other tasks).

## Checklist

- [ ] Difficulty and role choice validated and tested
- [ ] Rematch keeps players, difficulty and role mode, tested
- [ ] The deal is animated step by step and is not replayed on a reload
- [ ] Full run passes

## Decisions

Settled with the user before task 1:

- **Role mode:** random deal by default (the rulebook); "choose roles" is a lobby option.
- **When:** the "before the game" step comes before the board is dealt, in both modes. The turn order is drawn when it starts; in random mode the roles too. Once everyone has confirmed, the board is dealt with those roles.
- **The panel is always shown**, random mode included: turn order, everyone's role (or the role to pick) and the difficulty; everyone confirms.
- **Picking:** each player picks a role nobody else has and may change it until confirming; confirming locks the pick, and an "Undo" button (the `unconfirm` move) takes the confirm back until the last player confirms; the game starts when everyone has confirmed.
- **Rematch:** same players, difficulty and role mode, a new turn order; in choose mode everyone picks again from scratch; the difficulty is not changed there (a new game for that). After someone left, whoever is still seated (2 or more) plays.
- **No Flight Log** for Pandemic. Ended matches are kept as Sky Team's: abandoned ones for 1 day, finished ones for 30 days.
- **Deal animation** (tasks 6 to 8): the rulebook's order (the station and the pawns, the starting infections, the hands, then the player deck built in its epidemic piles, shown with card backs only); about 10 seconds in all, with no "Skip" button (only the browser's reduced-motion setting shows the board at once); animated after "Play again" too; seen by everyone (players and spectators) watching the game go from the "before the game" step to the board in that session, while a page opened later shows the board at once.
- **Playwright:** one real 3-player game played to its end by passing; 2- and 4-player smoke tests from prepared positions; each difficulty is covered by the engine kit runs.

## Open questions

- None so far.

**Done when:** 2, 3 and 4 players finish a game on desktop at each difficulty, with roles dealt or chosen, and each new game's deal is shown step by step.
