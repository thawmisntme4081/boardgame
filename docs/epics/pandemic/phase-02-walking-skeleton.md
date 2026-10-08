# Pandemic 02: Platform for N seats and a walking skeleton

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **medium-high**

Needs [Pandemic 01](phase-01-rules-core.md). This is the phase that proves the platform: every change in the platform packages stays game-agnostic and is recorded in the [multi-game proposal](../../proposals/multi-game-platform.md).

## Goals

- The platform hosts two games with different types and 2–4 seats, Sky Team playing exactly as before.
- A plain, ugly but complete Pandemic client, so three players finish a basic game (no roles, no events) online. The real board comes in phase 03.

## Feature scope

- **In:** the server registry for several games (`packages/server/src/games.ts` today aliases Sky Team's types as the platform's); rooms with 2–4 seats that start when the chosen number of players is seated; rematch with N players (today "both players"); presence toasts and the waiting room by player name, not "your partner"; `games/pandemic/client` (`@pandemic/client`) as a lazy `GameClientModule` with a list-based board.
- **Out:** the map and real layouts (03), roles (04), events (05), lobby options beyond the number of players (06).

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with its tests passing.

**Platform**

- [ ] 1. **M** Registry: one entry per game behind an erased `GameEntry` (state, move, view and config `unknown` at the platform's edge, each game's schemas check them); `rooms.ts`, the store and `handlers.ts` use it; Sky Team tests unchanged.
- [ ] 2. **L** Register `pandemic` on the server (lobby schema `players` 2–4, `keepEnded`); a server test playing moves in a 3-seat room through `rooms.move`.
- [ ] 3. **M** Rooms with N seats: joining fills the next free seat, the game starts when `players` seats are filled, `room:choose-seat` for N seats; protocol and server tests.
- [ ] 4. **M** Rematch with N players: the offer needs every seated player (`requestRematch` / `declineRematch`); tests for 2 and 3 players, Sky Team's behaviour unchanged.
- [ ] 5. **M** Client shell: presence toasts by name, the waiting room for N seats (`screens/Room.tsx`), new strings in `packages/ui/src/locales` (en, vi, fr).
- [ ] 6. **L** Write each contract change in the proposal.

**Skeleton client**

- [ ] 7. **L** `games/pandemic/client`: package, store `usePandemic` following views through `onView`, i18n namespace `pandemic` (English only for now), `styles.css`; listed in `packages/web/src/games.ts`, `games.pandemic` texts, `@import` / `@source` in `index.css`; check the build makes a lazy `assets/pandemic-*.js`.
- [ ] 8. **L** `SetupForm` with the number of players only; `WaitingInfo`.
- [ ] 9. **M** Plain board: cities with cubes as a list, tracks as text, every hand, the actions as simple buttons and selects (using `canActInView`), Draw and Infect buttons, the discard and share prompts.
- [ ] 10. **M** Playwright: three players finish a basic game on a fixed seed (`GAME_SEED`, with `E2E_HOOKS` to start near the end) on Desktop Chrome.

## Checklist

- [ ] Registry holds two games; no Pandemic import outside the two `games.ts` registries
- [ ] 2–4 seat rooms and N-player rematch tested
- [ ] Sky Team's full run still green (`pnpm test`, `pnpm e2e`)
- [ ] Three players finish a basic game in Playwright
- [ ] Contract changes recorded in the proposal

**Done when:** three browsers finish a basic Pandemic game, Sky Team's full test run is green, and no Pandemic code is in the platform packages.
