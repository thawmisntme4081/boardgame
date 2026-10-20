# Pandemic 02: Platform for N seats and a walking skeleton

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ✅ Done** · Effort: **medium-high**

Needs [Pandemic 01](phase-01-rules-core.md). This is the phase that proves the platform: every change in the platform packages stays game-agnostic and is recorded in the [multi-game proposal](../../proposals/multi-game-platform.md).

## Goals

- The platform hosts two games with different types and 2–4 seats, Sky Team playing exactly as before.
- A plain, ugly but complete Pandemic client, so three players finish a basic game (no roles, no events) online. The real board comes in phase 03.

## Feature scope

- **In:** the server registry for several games (`packages/server/src/games.ts` today aliases Sky Team's types as the platform's); rooms with 2–4 seats that start when the chosen number of players is seated; rematch with N players (today "both players"); presence toasts and the waiting room by player name, not "your partner"; `games/pandemic/client` (`@pandemic/client`) as a lazy `GameClientModule` with a list-based board.
- **Out:** the map and real layouts (03), roles (04), events (05), lobby options beyond the number of players (06).

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with typecheck, lint and format passing; tests are written and run at the end of the phase, after your review.

**Platform**

- [x] 1. **M** Registry: one entry per game behind an erased `GameEntry` (state, move, view and config `unknown` at the platform's edge, each game's schemas check them); `rooms.ts`, the store and `handlers.ts` use it; Sky Team tests unchanged.
- [x] 2. **L** Register `pandemic` on the server (lobby schema `players` 2–4; `keepEnded` like Sky Team's: abandoned 1 day, finished 30 days; idle rooms swept after a day instead of 30 minutes, a per-game setting); a server test playing moves in a 3-seat room through `rooms.move`. Done with the waiting state pulled forward from task 3 (`table.ts`: `openTable`, `checkJoin`, `seatJoined`; `WaitingView`), since a room is created with its creator alone.
- [x] 3. **M** Rooms with N seats: joining fills the next free seat, the game starts when `players` seats are filled, a number fixed in the lobby (2, 3 or 4; never earlier with fewer) (Pandemic's `setup` returns a `waiting` state with the seed; each `table:join` adds a seat; the last one deals the game), `room:choose-seat` for N seats; a player who leaves mid-game frees the seat but not the hand, and whoever joins next takes it over; protocol and server tests. Contract changes made (for task 6): the engine's `table:leave` move and `meta.leave` (`'restart'` default, `'hold'`); `rooms.join` takes the first free seat the game's `table:join` check accepts; Pandemic's waiting state; the registry's per-game `idleTtlMs`.
- [x] 4. **M** Rematch with N players: the offer needs every seated player (`requestRematch` / `declineRematch`); when someone left after the game, the players still seated (2 or more) start the new game together, same epidemic count; tests for 2 and 3 players, Sky Team's behavior unchanged. Contract changes made (for task 6): `room:rematch-offer` and `RematchState` carry `accepted` (the seats that asked so far, the offerer first); a player who accepted can take the answer back with `room:rematch-decline`; an offer starts once every seated player asked, also when the last one who had not answered leaves; Pandemic's `setup` with a played `previous` deals for the players still seated (2 or more).
- [x] 5. **M** Client shell: presence toasts by name, the waiting room for N seats (`screens/Room.tsx`), new strings in `packages/ui/src/locales` (en, vi, fr). Done: the server's presence lists the seats in play (a 3-player game has 3); toasts follow each player separately; the waiting room lists the players by name when a table has more than 2 seats; the seat texts are in en, vi and fr.
- [x] 6. **L** Write each contract change in the proposal.

**Skeleton client**

- [x] 7. **L** `games/pandemic/client`: package, store `usePandemic` following views through `onView`, i18n namespace `pandemic` (English only for now), `styles.css`; listed in `packages/web/src/games.ts`, `games.pandemic` texts, `@import` / `@source` in `index.css`; check the build makes a lazy `assets/pandemic-*.js`.
- [x] 8. **L** `SetupForm` with the number of players only; `WaitingInfo`.
- [x] 9. **M** Plain board: cities with cubes as a list, tracks as text, every hand, the actions as simple buttons and selects (using `canActInView`), Draw and Infect buttons, the discard and share prompts.
- [x] 10. **M** Playwright: three players finish a basic game on a fixed seed (`GAME_SEED`, with `E2E_HOOKS` to start near the end) on Desktop Chrome.

## Checklist

- [x] Registry holds two games; no Pandemic import outside the two `games.ts` registries (plus the places every game is wired: `index.css`, `i18next.d.ts`, the picker texts and the package dependencies)
- [x] 2–4 seat rooms and N-player rematch tested
- [x] Sky Team's full run still green (`pnpm test`, `pnpm e2e`)
- [x] Three players finish a basic game in Playwright
- [x] Contract changes recorded in the proposal (section 4.7)

## Open questions

- None.

**Done when:** three browsers finish a basic Pandemic game, Sky Team's full test run is green, and no Pandemic code is in the platform packages. ✅ Verified (`pnpm test`: 700 of 702 passed, and the two timeouts under the parallel run pass alone; `pnpm e2e`: Sky Team all green, and the Pandemic 3-player test passes on Desktop Chrome; typecheck, lint, format and build pass).
