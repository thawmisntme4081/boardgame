# Pandemic 06: Setup and variants

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: 🚧 In progress** · Effort: **medium**

Needs [Pandemic 05](phase-05-events.md).

## Goals

- Everything chosen before the first turn. Ends with the epic's check: 2–4 players finish a game on desktop.

## Feature scope

- **In:** difficulty (introductory 4, standard 5, heroic 6 epidemics) in the lobby; roles dealt at random or chosen in a "before the game" step before the board is dealt (each player picks a free role, then everyone confirms, like Sky Team's `crew`); a random turn order drawn when that step starts and shown in it; a rematch keeps the players, difficulty and role mode, with a new turn order.
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

- [ ] 5. **M** Playwright: a full 3-player game on Desktop Chrome, played to its end by passing every turn; 2- and 4-player smoke tests from prepared positions.
- [ ] 6. **M** Write the phase's tests and run the full suite: `pnpm test`, `pnpm e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (after your review of the other tasks).

## Checklist

- [ ] Difficulty and role choice validated and tested
- [ ] Rematch keeps players, difficulty and role mode, tested
- [ ] Full run passes

## Decisions

Settled with the user before task 1:

- **Role mode:** random deal by default (the rulebook); "choose roles" is a lobby option.
- **When:** the "before the game" step comes before the board is dealt, in both modes. The turn order is drawn when it starts; in random mode the roles too. Once everyone has confirmed, the board is dealt with those roles.
- **The panel is always shown**, random mode included: turn order, everyone's role (or the role to pick) and the difficulty; everyone confirms.
- **Picking:** each player picks a role nobody else has and may change it until confirming; confirming locks the pick; the game starts when everyone has confirmed.
- **Rematch:** same players, difficulty and role mode, a new turn order; in choose mode everyone picks again from scratch; the difficulty is not changed there (a new game for that). After someone left, whoever is still seated (2 or more) plays.
- **No Flight Log** for Pandemic. Ended matches are kept as Sky Team's: abandoned ones for 1 day, finished ones for 30 days.
- **Playwright:** one real 3-player game played to its end by passing; 2- and 4-player smoke tests from prepared positions; each difficulty is covered by the engine kit runs.

## Open questions

- None so far.

**Done when:** 2, 3 and 4 players finish a game on desktop at each difficulty, with roles dealt or chosen.
