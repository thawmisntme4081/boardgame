# Platform 02: Everything is a move

[← Platform epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ✅ Done (Oct 6, 2026)** · Effort: **medium**

Design reference: [multi-game proposal](../../proposals/multi-game-platform.md), sections 3 and 4.3 (step B).

## Goals

- Every change to a game goes through `apply`: player actions, setup choices, and server events (timers, auto-rolls).
- The server's `Room` knows nothing about Sky Team.

## Feature scope

- **In:** "ready", ability picks and confirm as game moves stored in the game state; the round timer and Total Trust's auto-roll as `schedule` entries sent as `'system'` moves; a generic scheduler in the server.
- **Out:** the wire protocol (Platform 03); persistence of the schedule (Platform 04 reloads it from state).

## Technical tasks

1. Move `pick`, `confirmed`, `ready` and the role choice from `Room`/`Player` into Sky Team's state and view; presence keeps only `name`, `online`, `creator`.
2. Round timer: `schedule(state)` returns the expiry as a system move; the "deadline check before every move" becomes part of `validate`.
3. Total Trust: the auto-roll after `NEXT_TURN_MS` becomes a scheduled system move.
4. Generic scheduler: arms timers from `schedule(state)` after every accepted move, cancels stale ones, re-arms on load.
5. Remove `timed`, `autoRollAt`, `roundTimer` and `rolesChosen` from `Room`.
6. The socket handlers call `skyTeam.validate` / `apply` (from `@sky/shared/definition`, Platform 01) instead of the rule functions. Add the new seat moves (`choose-seat`, `pick-ability`, `confirm`, `ready`) to `skyTeamMoveSchema`; `ready` then leads to the system `roll`. Decide whether the duplicate-`place` no-op moves into `validate` (Platform 01 left it in the handler).

## What was built

- **Engine contract** (`packages/engine/src/index.ts`): `validate` / `apply` take a move context `{ by, at }` (the platform stamps the time; `roll` and `time-up` no longer carry `at`); `setup` gets the seats taken, the `host` and the `previous` game at the table; the platform's table moves `table:join` and `table:choose-seat`; `runDue` (make every due scheduled move, each at its own time) and `nextDue`. The kit plays table and scheduled moves too, and checks that every scheduled move is valid at its own time.
- **Sky Team** (`packages/shared`): `GameState.crew` (host, seated, `rolesChosen`, picks, confirmed, ready) with its rules in `crew.ts`, moved from `rooms.ts`; `autoRollAt` / `autoRollDelayMs` with `armAutoRoll` and `canAutoRoll` in `rules.ts`; `rollDice` clears "ready". The definition's moves: `pick-ability`, `confirm`, `ready` (the second one rolls), the placing moves, and the system `roll` (Total Trust) and `time-up`, both from `schedule`. The view carries `crew`; presence only `name`, `online`, `creator`. The setup error codes moved from `ErrorCode` to `MoveError` (same strings).
- **Server**: `games.ts` (the registry); `rooms.ts` generic: a room holds players (seat, name, token, socket, creator), `config`, the game and one `timer`; `move`, `runDue`, `arm` / `onScheduled` (the scheduler), `chooseSeat` (creator check, then the game's `table:choose-seat`), `rematch(room, config?)`. `broadcastRoom` saves and re-arms. `handlers.ts` turns each `game:*` event into `{ type, ...payload }` through the game's `moveSchema`, and the lobby's `timer` / `scenario` into the game's config (`roundTimerMs` and `autoRollDelayMs` are now server options, not room options). Saved rooms: `ROOM_FORMAT` 2 (players, `config`, game; old rows are dropped).
- **Client**: `Preflight` and the "Roll dice" button read `view.crew` instead of presence.
- **E2E on WebKit**: the iPhone 13 project waits up to 15 s in its checks (`expect.timeout` on that project in `playwright.config.ts`); the other devices keep 5 s. See "E2E flake" below.
- **Tests**: no behavior assertion was dropped; tests that read the old room fields now read the same facts where they live (`room.game.crew`, the view's `crew`, `room.timer`, `room.game.autoRollAt`). The room setup tests call `rooms.move` / `rooms.chooseSeat`; new: the scheduler on fake timers (`rooms.test.ts`), the crew moves through the definition (`definition.test.ts`).

## E2E flake (found and fixed in this phase)

- **Symptom:** in full runs, one or two iPhone 13 tests failed now and then, always a check right after a page reload or a new view ("Connecting to your game…" still on screen, or the "Smooth landing!" dialog appearing just after the check gave up).
- **Not a regression:** the same tests failed the same way on the Platform 01 build (A/B on iPhone 13, alternating builds: Platform 01 failed 3 times in 2 runs, Platform 02 once in 2). Alone, both tests pass every time.
- **Root cause:** time spent inside WebKit, not on the network or the server. Traces show every request of a reload (page, scripts, `/auth/status`, the Socket.IO handshake, the Game chunk) done within about 0.45 s, and the server logged no errors; the rest, up to the board being drawn, is WebKit parsing and rendering, 1–2 s with little load. With every worker busy (8 workers, two WebKit pages per test), that grows past Playwright's default 5 s check timeout.
- **Fix:** `expect: { timeout: 15_000 }` on the iPhone 13 project only. The app is unchanged; a check still fails if the page never gets there.

## Open questions

None open.

## Checklist

- [x] Setup choices and "ready" are game moves
- [x] Round timer and auto-roll are scheduled system moves
- [x] Generic scheduler with tests (fake clock)
- [x] `Room` free of Sky Team fields
- [x] Protocol and game-rules docs, `CLAUDE.md` updated

**Done when:** all current unit and Playwright tests pass (timer and Total Trust included), and `rooms.ts` imports nothing Sky Team-specific beyond the game registry. ✅ Verified Oct 6, 2026 (`rooms.ts` imports `@platform/engine`, `./games`, `./schemas`, `./store` only; 407 unit and integration tests, timer and Total Trust included; Playwright 41 passed in three full runs in a row on three devices, 4 intentional skips; typecheck, lint, format and build pass).
