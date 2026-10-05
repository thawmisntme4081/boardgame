# Platform 02: Everything is a move

[← Platform epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **medium**

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

## Checklist

- [ ] Setup choices and "ready" are game moves
- [ ] Round timer and auto-roll are scheduled system moves
- [ ] Generic scheduler with tests (fake clock)
- [ ] `Room` free of Sky Team fields
- [ ] Protocol and game-rules docs, `CLAUDE.md` updated

**Done when:** all current unit and Playwright tests pass (timer and Total Trust included), and `rooms.ts` imports nothing Sky Team-specific beyond the game registry.
