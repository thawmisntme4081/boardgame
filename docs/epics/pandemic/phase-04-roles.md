# Pandemic 04: Roles

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ✅ Done** · Effort: **high**

Needs [Pandemic 03](phase-03-board-and-client.md). Rules and UI together.

## Goals

- Twelve roles, as hooks the core rules call (like Sky Team's `RuleModule`s; the core never tests for a role by name), dealt at random and usable from the board: the base game's seven, four fan-made roles (the Teacher, the Relocation Specialist, the Crisis Mitigator, the Generalist) and the Gen Con 2016 promo role (the Z-Force Team Member).

## Feature scope

- **In:**
  - **Contingency Planner:** stores an event taken from the discard pile (playing it is phase 05).
  - **Dispatcher:** moves another pawn as their own, or any pawn to a city with another pawn.
  - **Medic:** treats all cubes of a color; clears and blocks cured cubes where they stand.
  - **Operations Expert:** builds without a card; once a turn, from a station, discards any city card to move anywhere.
  - **Quarantine Specialist:** no cubes or outbreaks in their city and the connected ones.
  - **Researcher:** gives any city card.
  - **Scientist:** cures with 4 cards.
  - **Teacher:** creates up to two student pawns and chooses the pawn that does each turn's actions.
  - **Relocation Specialist:** takes up to 3 cubes and 1 other pawn along whenever its pawn leaves a city.
  - **Crisis Mitigator:** 4 to 7 actions a turn, from the cubes in their city.
  - **Generalist:** 5 actions a turn.
  - **Z-Force Team Member:** starts in Montreal, moves to Montreal or Essen, cures with up to 2 other players' cards.
  - A random deal at setup from all twelve; role cards and pawn colors on the board.
- **Out:** choosing roles in a preflight step (06).
- **Decided with the user:**
  - Pawns take their role's color (as in the box; seat colors stay for names and the log). The added roles' colors: the Teacher a deep violet (`oklch(0.45 0.2 290)`, apart from the Dispatcher's purple-magenta), the Relocation Specialist indigo, the Crisis Mitigator pink, the Generalist slate gray, the Z-Force Team Member crimson.
  - The role card is a text card in the role's color with its name, the power in a popover (no pictures).
  - Every role is always in the deal: no lobby option, no "fan-made" or "promo" note.
  - Pandemic matches saved before this phase are not migrated: the rules `version` goes up and older matches are dropped on load (Pandemic is not deployed).
- **Pawns:** a seat has its own pawn and, with the Teacher, up to two students. A pawn is named by a `PawnId` (`p1` a seat's own pawn, `p1-s1` / `p1-s2` its students), not by a seat: in `pawns`, the moves, the move offers, Airlift, the Dispatcher and the views. Its owner (`pawnOwner`) answers offers to move it, and only a seat's own pawn has a role power.

## Role rules, settled with the user

**Base game**

- Roles are dealt after the initial infection (the rulebook's setup order), so the Medic and the Quarantine Specialist do not change the 9 starting cities.
- The Medic clears cured cubes however they arrive (their own move, the Dispatcher, Airlift, a Relocation Specialist taking them along), and in their current city at once when a cure is discovered.
- The Dispatcher moving another pawn by Direct or Charter Flight discards the card from the Dispatcher's own hand (Charter: the card of the city that pawn is in). Moving another player's pawn is an offer its owner accepts or declines; the Dispatcher can cancel.
- The Operations Expert's flight is an action, once per turn, from a station, discarding any city card; it is not available when the Dispatcher moves the Operations Expert.
- The Contingency Planner's take is an action; at most one stored event, which does not count toward the hand limit and is removed from the game once played.
- The Quarantine Specialist blocks cubes in every infection (Infect step, epidemics, outbreaks); an outbreak into a protected city places nothing there and does not chain from it.
- The Researcher gives any city card, whatever city they share; another player may also take any city card from the Researcher (same city, on either player's turn as the active player).

**Teacher** (fan-made). The card, as the user wrote it: as an action, create a student pawn in the city you are in. At the start of your turn, choose either the teacher pawn or one of your student pawns, and use that pawn to do the actions of this turn. Student pawns can do all basic actions but cannot create student pawns. The teacher and the students share the same information and use the same hand of cards, which is still subject to the hand limit. Only the teacher pawn creates student pawns; at most two students can be created in a game; once you start using a pawn you finish the turn with it.

- **The pawn choice** starts the Teacher's turn (`choose-pawn`, not an action); until it is made her actions are off; with no students it is made for her (the teacher pawn). The choice holds until the turn ends.
- **Creating a student** is an action of the teacher pawn; the student appears in the teacher's city. At most two a game, both in one turn if she likes; a new game starts with none; nothing removes a pawn.
- **A student does every basic action** with the Teacher's hand: drive or ferry, direct flight, charter flight (the card of the student's own city), shuttle, build (the card of the student's city, the station there), treat, cure (at a station in the student's city), Share Knowledge (in the student's city).
- **A student is a plain pawn:** no power of its own. Share Knowledge counts a student in the city as the Teacher being there; the Dispatcher and Airlift may move a student, with the Teacher's agreement; Government Grant is unaffected.
- **On the map:** the teacher pawn has a white star; the students are plain, in the same violet.

**Relocation Specialist** (fan-made). The card, as the user wrote it: when you leave a city by any means, you may take up to 3 disease cubes and/or 1 other pawn with you to your destination city.

- **"By any means"** is every way its pawn leaves a city: its own moves, the Dispatcher's moves and Airlift. On its own moves (and an Airlift it plays on itself) it chooses what comes along with the move; when another player moves it (an offer it answers), it chooses when accepting.
- **What comes along:** up to 3 cubes of any colors from the city it leaves, and/or 1 other pawn standing there (another player's, or a Teacher's student).
- **A pawn taken along is an offer** its owner accepts or declines. Declined, the whole move is called off: nothing happens, no action or card is spent, and the Relocation Specialist may move again alone or with something else. The same when the pawn was chosen while accepting someone else's move. The player who made the move can cancel.
- **Arriving:** the pawns arrive first (a carried Medic already clears and protects), then the cubes, color by color: a protected city (a cured color where the Medic stands; the Quarantine Specialist's city and its neighbors) takes none, they go back to the supply; otherwise up to 3 of a color stay, and if there was not room the city outbreaks once in that color (chain reactions as usual; outbreaks can lose the game) and the extra cubes go back to the supply.

**Crisis Mitigator** (fan-made). The card, as the user wrote it: take actions each turn according to the number of disease cubes (of any color) in your city at the beginning of your turn: 0–1: 4 actions, 2: 5, 3: 6, 4+: 7.

- The cubes of every color in the city of their pawn when the turn starts, the first turn of the game included; the count is fixed for the turn.

**Generalist** (fan-made): 5 actions every turn instead of 4.

**Z-Force Team Member** (an official Z-Man promo from Gen Con 2016, [BoardGameGeek](https://boardgamegeek.com/boardgameexpansion/205666/pandemic-gen-con-2016-promos-z-force-team-memberga)). The card as we understood it (BoardGameGeek refuses automated reading, so this is from a paraphrase the user confirmed, not the printed wording): starts in Montreal (not Atlanta). As an action, move to Montreal or Essen. When this player discovers a cure, other players in the same city may contribute up to 2 of the cards.

- **Montreal or Essen** is an action, as often as the player likes, from anywhere, with no card; only for their own moves (the Dispatcher cannot use it on them).
- **A helped cure** still needs 5 cards of the color at a research station: at least 3 from the Z-Force player, at most 2 in total from other players in the city (one or two of them; a player is there if any of their pawns is, as for Share Knowledge). It is an offer: every helper whose card is used accepts, in any order; one decline calls the cure off (no action spent); the Z-Force player can cancel.

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with typecheck, lint and format passing; tests are written and run at the end of the phase, after your review.

**Rules**

- [x] 1. **M** `roles/` with a `RoleModule` hook interface; the core calls the hooks and never names a role; a random deal from `ROLE_IDS` in `setup`. Done: hooks `cardsToCure`, `canGive`, `movesPawns`, `buildsWithoutCard`, `storesEvent`, `treatsAll`, `onEnterCity`, `onCure`, `preventsCube`, `actionsPerTurn` (read when a turn starts: `endTurn`, and the first turn in `createGame`), `startCity`, `carries`, `cureHelp`, and the role's own actions (`checkAction` / `applyAction`).
- [x] 2. **M** Pawn identity and the pawn of the turn: `PawnId`, `pawnOwner`, `pawnsOnMap`; `pawns` keyed by `PawnId`; `turn.pawn` with `choose-pawn`, `actingPawn` and `startingPawn` in `pawns.ts` (a seat with several pawns chooses; until then `checkTurnAction` refuses with `choose-pawn-first`); every action, Share Knowledge and the role actions work on the chosen pawn; `movePawn` runs `onEnterCity` only for a seat's own pawn.
- [x] 3. **L** The roles that change one number: the Scientist (`cardsToCure`), the Researcher (`canGive`), the Generalist and the Crisis Mitigator (`actionsPerTurn`, `roles/crisisMitigator.ts`).
- [x] 4. **M** Operations Expert: the free build and the once-a-turn flight (`ops-flight`).
- [x] 5. **M** Medic: treating, clearing on entering a city and when a cure is found, blocking cured cubes, outbreak chains next to the Medic.
- [x] 6. **M** Quarantine Specialist: blocked cubes and outbreaks in a chain.
- [x] 7. **M** Dispatcher: moves `by` the Dispatcher for another `pawn`; moving someone else's pawn is an offer its owner answers (`moveOffer.ts`: `move-accept`, `move-decline`, `move-cancel`), like Share Knowledge.
- [x] 8. **L** Contingency Planner: taking and storing an event (`take-event`, `GameState.contingency`).
- [x] 9. **M** Teacher: `create-student` (`roles/teacher.ts`, `MAX_STUDENTS`), from the teacher pawn, in its city.
- [x] 10. **M** Relocation Specialist (`carry.ts`): `carry` (`cubes`, one color per cube, at most 3, and a `pawn`) on its pawn moves, on Airlift and on `move-accept` (`canCarryOnAccept`); `checkCarry`; a pawn taken along is an offer to its owner (`answeringPawn`; a move offer's `pending.pawn` is the pawn whose owner answers, the moved one or the one taken along), a second offer after an accepted Dispatcher or Airlift move; `moveWith` (pawns, then cubes through `putCubes` in `outbreak.ts`); a `carried` log entry per color; reason `too-many-cubes`.
- [x] 11. **M** Z-Force Team Member (`roles/zForceTeamMember.ts`): `startCity` Montreal, the `montreal-essen` action (`ZFORCE_CITIES`); the helped cure in `cure.ts` (`cure` with `help: { seat, city }[]`, at most `cureHelp`; `checkCure`, `discoverCure`; pending `{ kind: 'cure', by, move, waiting }` answered by `cure-accept`, `cure-decline`, `cure-cancel`; `actors` prompts every helper still waiting).
- [x] 12. **L** Random play and the move schema for every role (`random-play.ts`: carries now and then, answers offers with a carry, helped cures, the role actions through `legalRoleActions`); a fast-check run with random roles (cubes and cards conserved, a seat's pawns, no crash); the engine kit with roles.

**Client**

- [x] 13. **L** Role card per player (name, power in a popover; the Teacher's "Students: n / 2", the Contingency Planner's stored event) and pawn colors (`--color-role-*`); the pre-game grid of 12 roles (4 by 3).
- [x] 14. **M** Role controls in the action bar: the Dispatcher choosing which pawn to move, the Operations Expert's flight, the Contingency Planner's take, the Teacher's "Choose the pawn for this turn" and "Create a student", the Z-Force's "Go to Montreal" / "Go to Essen"; every pawn on the map (a white star on the teacher pawn, `data-cube-city` on cubes); the map and the move menu move the chosen pawn; Airlift and the Dispatcher list every pawn ("X's student").
- [x] 15. **M** Offers and pickers: the Relocation Specialist's "Take along" picker (`CarryPicker`: a "−" / "+" per cube color, a "Take …" toggle per pawn; `carry` in the store) in the action bar, under Airlift on its own pawn and when accepting a move; the prompt "X offers to take Y along to Z"; outbreaks from carried cubes animated; the cure picker with the helpers' cards ("London (Ben)") and the helpers' prompt ("Give the cards" / "Decline" / "Cancel the cure"); English texts.

**Tests**

- [x] 16. **L** Playwright: the Dispatcher moves the Medic, who then treats a stack; a Teacher creates a student and uses it for a turn; a Relocation Specialist takes cubes and a pawn along; a Generalist's turn has 5 actions; a Z-Force Team Member cures with a partner's cards.
- [x] 17. **M** Write the phase's tests and run the full suite (after your review): `pnpm test`, `pnpm e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`. Done: `roles.test.ts`, `roles.powers.test.ts` (each base role, the fast-check run with any roles), `teacher.test.ts`, `newRoles.test.ts` (the Relocation Specialist, the Crisis Mitigator, the Generalist), `zForce.test.ts`, each with random games through the engine kit; on the client `teacher.test.tsx`, `carry.test.tsx`, `zForce.test.tsx`; tests that depend on the random deal accept any role's start city and 4 to 7 starting actions.

## Checklist

- [x] Every role tested on its own; the core names no role
- [x] Property test with random roles passes
- [x] Role controls, offers and pickers on the board, tested
- [x] Random games with each added role through the engine kit

## Open questions

- None: every question is settled (see above).

**Done when:** a game with random roles plays every role power from the board, with their tests passing. ✅ Verified (`pnpm test` 975 passed, `pnpm e2e` 57 passed/32 skipped (+1 Sky Team iPhone 13 WebKit timeout under full load, passing alone), `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` pass).
