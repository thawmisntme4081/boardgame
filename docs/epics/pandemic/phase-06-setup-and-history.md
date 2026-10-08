# Pandemic 06: Setup, variants and history

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **medium**

Needs [Pandemic 05](phase-05-events.md).

## Goals

- Everything chosen before the first turn, and each player's record of past games. Ends with the epic's check: 2–4 players finish a game on phones and desktop.

## Feature scope

- **In:** difficulty (introductory 4, standard 5, heroic 6 epidemics) in the lobby and rematch; roles dealt at random or chosen in a "before the game" step (each player picks a free role, then everyone confirms, like Sky Team's `crew`); the first player is the one whose hand holds the city with the highest population; a rematch keeps the players and difficulty; the Flight Log section for Pandemic (`flightRecord` / `importRecord` in the registry, `History` in the client module, a device copy for guests).

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with its tests passing.

**Rules**

- [ ] 1. **L** Lobby schema and `configSchema` with `epidemics` and a role mode (random / choose); the server refuses a bad config.
- [ ] 2. **M** A `setup` step in `GameState` with `pick-role` and `confirm` moves; random deal when chosen.
- [ ] 3. **L** First player by highest population; `setup.previous` for a rematch.

**Client**

- [ ] 4. **M** `SetupForm` (players, difficulty, role mode) and the "before the game" panel (pick a role, confirm).
- [ ] 5. **M** `recordOf` in `@pandemic/rules` (result, reason, difficulty, roles, players, turns); registry `flightRecord`, `importRecord`, `keepEnded`; server tests.
- [ ] 6. **M** `History` component and the guest copy in `localStorage`; synced on sign-in like Sky Team's.

**Checks**

- [ ] 7. **M** Playwright: a full 3-player game on iPhone 13 and Pixel 7; 2- and 4-player smoke tests; the full run (`pnpm test`, `pnpm e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`).

## Checklist

- [ ] Difficulty and role choice validated and tested
- [ ] First player rule tested
- [ ] Flight Log records Pandemic games, signed in and as a guest
- [ ] Full run passes

## Open questions

- Roles: random deal by default (as the rulebook), choosing as an option. Assumption (to confirm).

**Done when:** 2, 3 and 4 players finish a game on phones and desktop at each difficulty, and it shows in their Flight Log.
