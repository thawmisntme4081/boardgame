# Pandemic 04: Roles

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **medium-high**

Needs [Pandemic 03](phase-03-board-and-client.md). Rules and UI together.

## Goals

- The seven base-game roles, as hooks the core rules call (as Sky Team's `RuleModule`s; the core never tests for a role by name), dealt at random and usable from the board.

## Feature scope

- **In:** Contingency Planner (stores an event taken from the discard pile; playing it is phase 05), Dispatcher (moves another pawn as their own, or to a city with another pawn), Medic (treats all cubes of a color; clears and blocks cured cubes where they stand), Operations Expert (builds without a card; once a turn, from a station, discards any city card to move anywhere), Quarantine Specialist (no cubes or outbreaks in their city and the connected ones), Researcher (gives any city card), Scientist (cures with 4 cards); a random deal at setup; role cards and pawn colors on the board.
- **Out:** choosing roles in a preflight step (06).

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with typecheck, lint and format passing; tests are written and run at the end of the phase, after your review.

**Rules**

- [ ] 1. **M** `roles/` with a `RoleModule` hook interface (`cardsToCure`, `canGive`, `onEnterCity`, `preventsCube`, extra actions…); the core calls the hooks; a random role deal in `setup`.
- [ ] 2. **L** Scientist and Researcher.
- [ ] 3. **M** Operations Expert: the free build and the once-a-turn flight.
- [ ] 4. **M** Medic: treating, clearing on entering a city, blocking cured cubes, outbreak chains next to the Medic.
- [ ] 5. **M** Quarantine Specialist: blocked cubes and outbreaks in a chain.
- [ ] 6. **M** Dispatcher: moves `by` the Dispatcher for another `pawn`; moving someone else's pawn is an offer its owner accepts or declines (the Dispatcher can cancel), like Share Knowledge.
- [ ] 7. **L** Contingency Planner: taking and storing an event.
- [ ] 8. **L** A fast-check run with random roles: cube conservation holds, no crash; the engine kit with roles.

**Client**

- [ ] 9. **L** Role card per player (name, power in a popover) and pawn colors.
- [ ] 10. **M** Role controls: the Dispatcher choosing which pawn to move, the Operations Expert's flight, the Contingency Planner's take.
- [ ] 11. **L** Playwright: one game where the Dispatcher and the Medic act.

## Checklist

- [ ] All seven roles tested on their own; the core names no role
- [ ] Property test with random roles passes
- [ ] Role controls on the board, tested

## Open questions

- None yet.

**Done when:** a game with random roles plays every role power from the board, with their tests passing.
