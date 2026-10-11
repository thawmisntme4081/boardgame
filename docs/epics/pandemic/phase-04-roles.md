# Pandemic 04: Roles

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ✅ Done** · Effort: **medium-high**

Needs [Pandemic 03](phase-03-board-and-client.md). Rules and UI together.

## Goals

- The seven base-game roles, as hooks the core rules call (as Sky Team's `RuleModule`s; the core never tests for a role by name), dealt at random and usable from the board.

## Feature scope

- **In:** Contingency Planner (stores an event taken from the discard pile; playing it is phase 05), Dispatcher (moves another pawn as their own, or to a city with another pawn), Medic (treats all cubes of a color; clears and blocks cured cubes where they stand), Operations Expert (builds without a card; once a turn, from a station, discards any city card to move anywhere), Quarantine Specialist (no cubes or outbreaks in their city and the connected ones), Researcher (gives any city card), Scientist (cures with 4 cards); a random deal at setup; role cards and pawn colors on the board.
- **Out:** choosing roles in a preflight step (06).
- **Decided with the user:** pawns take their role's color (as in the box; seat colors stay for names and the log); the role card is a text card in the role's color with its name, the power in a popover (no pictures); Pandemic matches saved before this phase are not migrated: the rules `version` goes up and older matches are dropped on load (Pandemic is not deployed).
- **Role rules confirmed with the user:**
  - Roles are dealt after the initial infection (the rulebook's setup order), so the Medic and the Quarantine Specialist do not change the 9 starting cities.
  - The Medic clears cured cubes however they arrive (their own move, the Dispatcher, Airlift), and in their current city at once when a cure is discovered.
  - The Dispatcher moving another pawn by Direct or Charter Flight discards the card from the Dispatcher's own hand (Charter: the card of the city that pawn is in).
  - The Operations Expert's flight is an action, once per turn, from a station, discarding any city card; it is not available when the Dispatcher moves the Operations Expert.
  - The Contingency Planner's take is an action; at most one stored event, which does not count toward the hand limit and is removed from the game once played.
  - The Quarantine Specialist blocks cubes in every infection (Infect step, epidemics, outbreaks); an outbreak into a protected city places nothing there and does not chain from it.
  - The Researcher gives any city card, whatever city they share; another player may also take any city card from the Researcher (same city, on either player's turn as the active player).

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with typecheck, lint and format passing; tests are written and run at the end of the phase, after your review.

**Rules**

- [x] 1. **M** `roles/` with a `RoleModule` hook interface (`cardsToCure`, `canGive`, `onEnterCity`, `preventsCube`, extra actions…); the core calls the hooks; a random role deal in `setup`.
- [x] 2. **L** Scientist and Researcher.
- [x] 3. **M** Operations Expert: the free build and the once-a-turn flight.
- [x] 4. **M** Medic: treating, clearing on entering a city, blocking cured cubes, outbreak chains next to the Medic.
- [x] 5. **M** Quarantine Specialist: blocked cubes and outbreaks in a chain.
- [x] 6. **M** Dispatcher: moves `by` the Dispatcher for another `pawn`; moving someone else's pawn is an offer its owner accepts or declines (the Dispatcher can cancel), like Share Knowledge.
- [x] 7. **L** Contingency Planner: taking and storing an event.
- [x] 8. **L** A fast-check run with random roles: cube conservation holds, no crash; the engine kit with roles.

**Client**

- [x] 9. **L** Role card per player (name, power in a popover) and pawn colors.
- [x] 10. **M** Role controls: the Dispatcher choosing which pawn to move, the Operations Expert's flight, the Contingency Planner's take.
- [x] 11. **L** Playwright: one game where the Dispatcher and the Medic act.

## Checklist

- [x] All seven roles tested on their own; the core names no role
- [x] Property test with random roles passes
- [x] Role controls on the board, tested

## Open questions

- None yet.

**Done when:** a game with random roles plays every role power from the board, with their tests passing. ✅ Verified (`pnpm test` 746 passed, `pnpm e2e` 47 passed/10 skipped, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` all pass).
