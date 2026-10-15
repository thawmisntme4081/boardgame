# Pandemic 04: Roles

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ✅ Done (the Teacher, tasks 12 to 18, included)** · Effort: **medium-high**

Needs [Pandemic 03](phase-03-board-and-client.md). Rules and UI together.

## Goals

- The seven base-game roles, plus the fan-made Teacher (added later, see below), as hooks the core rules call (as Sky Team's `RuleModule`s; the core never tests for a role by name), dealt at random and usable from the board.

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

**Teacher** (a fan-made role the user added to the base game after the phase was done)

The role, as the user wrote it:

- As an action, create a student pawn in the city you are in.
- At the start of your turn, choose either the teacher pawn or one of your student pawns, and use that pawn to do the actions of this turn.
- Student pawns can do all basic actions but cannot create student pawns. The teacher and the students share the same information and use the same hand of cards, which is still subject to the hand limit.
- Only the teacher pawn creates student pawns; at most two students can be created in a game; once you start using a pawn you finish the turn with it (you may pick another on your next turn).

Settled with the user (task 12):

- **The pawn choice** starts the Teacher's turn (a `choose-pawn` move, not an action); until it is made her actions are off; with no students it is made for her (the teacher pawn).
- **Creating a student** is an action of the teacher pawn (so the teacher is the chosen pawn that turn); the student appears in the teacher's city.
- **Two students per game**, at most; a new game starts with none; nothing removes a pawn.
- **A student does every basic action** with the Teacher's hand: drive or ferry, direct flight, charter flight (the card of the student's own city), shuttle, build (the card of the student's city, the station there), treat, cure (at a station in the student's city), share knowledge (in the student's city).
- **Other players and students:** Share Knowledge counts a student in the city as the Teacher being there; the Dispatcher and Airlift may move a student, with the Teacher's agreement; Government Grant is unaffected.
- **Eight roles:** the Teacher is in the role pool like the others, always (no lobby option, no "fan-made" note): a random deal draws from 8, and the "before the game" grid shows 8 (4 by 2).
- **A student is a plain pawn:** basic actions only, no special power; other players' roles work as now, around their own pawns.
- **Both students in one turn** is allowed (two of the Teacher's actions); the only limit is two per game.
- **Pawns:** the Teacher's color is purple (a deeper violet than the Dispatcher's purple-magenta, picked in task 16); the teacher pawn has a mark (a star or a ring), the students are plain, in the same purple.

It changes what a "pawn" is: every seat has exactly one pawn today (`pawns`, and `pawn?: SeatId` in moves, move offers, Airlift, the Dispatcher and the views). Task 12 settles the open questions below first; task 13 is the one large change.

- [x] 12. **L** Confirm the open questions below with the user and write the settled rules into this file.
- [x] 13. **M** Pawn identity: a pawn is a seat's teacher or student (a reference instead of a bare seat) in `pawns`, the moves, move offers, Airlift and the Dispatcher, the views and the random player; every existing role behaves as before; the rules `version` goes up (older matches are dropped). Done: `PawnId` (`p1` is a seat's own pawn, `p1-s1` / `p1-s2` its students), `pawnOwner` (who answers an offer, whose role reacts on arrival), `pawnsOnMap`; `pawns` is keyed by `PawnId`, so a stored move's `pawn: 'p2'` keeps its meaning; rules `version` 7.
- [x] 14. **M** The Teacher module: `create-student` (an action, from the teacher pawn, at most two per game, in the pawn's city), a `choose-pawn` move at the start of the turn that fixes the pawn for the turn, and every basic action working on the chosen pawn. Done: `pawns.ts` (`turn.pawn`, `choose-pawn`, `actingPawn`, `startingPawn`: a seat with several pawns chooses, the core never names the Teacher; until then `checkTurnAction` refuses with `choose-pawn-first`), `roles/teacher.ts` (`create-student`, `MAX_STUDENTS`), drive, flights, build, treat and cure on the chosen pawn; `teacher` is in `ROLE_IDS` (dealt from 8), with its English name, power and color only so the client builds (the rest of the client is task 16).
- [x] 15. **M** What else reads a pawn's city or role: Share Knowledge, cure and build (the chosen pawn's city), the Medic and the Quarantine Specialist (only their own pawn), the Operations Expert's flight, Airlift and Government Grant targets. Done: Share Knowledge in the chosen pawn's city, the partner there if any of its pawns is (`legalShareOffers` too; cure and build were done in task 14); `movePawn` calls `onEnterCity` only for a seat's own pawn, and role hooks read `pawns[holder]` (the own pawn), so the Medic, the Quarantine Specialist and the Operations Expert needed no change; Airlift may target any pawn (offer to its owner, task 13); Government Grant is unaffected; the action bar reads the chosen pawn's city.
- [x] 16. **M** Client: the teacher pawn marked and the students drawn on the map, the pawn choice at the start of the turn, the "Create student" button, the role card text and power popover, English texts; the role is dealt like the others (8 roles now). Done: every pawn on the map (`PAWN_IDS` order, a student drops in), a white star on the teacher pawn, students plain in the Teacher's violet (`oklch(0.45 0.2 290)`, kept); the action bar's "Choose the pawn for this turn" (one button per own pawn) and "This turn: …" line, "Create a student"; the map and the move menu work on the chosen pawn (`actingPawn`); Airlift and the Dispatcher list every pawn ("X's student"); the Teacher's role card shows "Students: n / 2"; the pre-game grid already holds 8 roles (4 by 2); English texts only (`pawns.*`, `actions.*`, `roles.students`).
- [x] 17. **L** Playwright: a Teacher creates a student, uses it for a turn (treat or build) and the choice is fixed for the turn. Written in `e2e/pandemic.spec.ts` (not run yet: it runs with the full suite in task 18).
- [x] 18. **M** Update the older e2e tests and test helpers that build a `turn` (add `pawn`), then write the Teacher's tests (the rules, random games with the Teacher in the kit and the property run, the client) and run the full suite: `pnpm test`, `pnpm e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (after your review of tasks 12 to 17). Done: `setTurnSeat` in the test helpers and `pawn` in every `turn` fixture (rules, client, e2e); role counts 7 → 8 (`types.test`, `preflight.test`, the e2e role grid); `teacher.test.ts` (pawn ids, create-student, the choice, every basic action on the chosen pawn, Share Knowledge, Dispatcher and Airlift on a student, the schema, random games with a Teacher through the kit), the property run with 8 roles also checks the pawns per seat, `teacher.test.tsx` (map, choice, button, role card, the chosen pawn's moves); `pnpm test` 908 passed, `pnpm e2e` 55 passed / 26 skipped, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` pass.

## Checklist

- [x] All seven roles tested on their own; the core names no role
- [x] Property test with random roles passes
- [x] Role controls on the board, tested
- [x] The Teacher: rules settled with the user, tested (random games and the property run included), and playable from the board

## Open questions

- None: every Teacher question is settled (see above).

**Done when:** a game with random roles plays every role power from the board, with their tests passing. ✅ Verified (`pnpm test` 746 passed, `pnpm e2e` 47 passed/10 skipped, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` all pass). Teacher tasks 12 to 18 ✅ Verified (`pnpm test` 908 passed, `pnpm e2e` 55 passed/26 skipped, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` all pass).
