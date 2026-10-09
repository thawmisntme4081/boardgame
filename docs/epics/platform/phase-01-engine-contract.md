# Platform 01: Engine contract

[← Platform epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ✅ Done** · Effort: **low-medium**

Design reference: [multi-game proposal](../../proposals/multi-game-platform.md), sections 4.1 and 4.6 (step A).

## Goals

- One game-agnostic interface, `GameDefinition`, that every game implements and the platform depends on.
- Sky Team runs through it with **no behavior change**.

## Feature scope

- **In:** a new `packages/engine` (the `GameDefinition` types, `Actor`, `Outcome`, `Result`, the seeded RNG moved from shared); a Sky Team adapter (`setup = createGame`, `apply` = dispatch over a Sky Team move union, `view = viewFor`, `outcome` from the phase); the engine test kit.
- **Out:** protocol changes (Platform 03); moving timers into the game (Platform 02); new repository layout for the client (Platform 05).

## Technical tasks

1. Create `packages/engine` with `GameDefinition<S, M, V, C>`, `Actor` (`turn`, `simultaneous`, `prompt`), `ScheduledMove`, `Outcome`, `SeatId`, and the RNG.
2. Define Sky Team's move union with one Zod `moveSchema`: seat moves `place`, `spend-reroll`, `reroll`, `ability`, `cancel-swap`; system moves `begin`, `roll`, `time-up` (decided when starting: `ready`, `pick-ability`, `confirm` and the seat choice come with Platform 02, which moves them into the game state).
3. Write the Sky Team definition as an adapter over the existing rule functions (no rule rewrites); `actors` from `phase`, `currentSeat` and `rerollPending`.
4. Engine test kit: random play through `GameDefinition` only, determinism (same seed and moves → same state), JSON round trip of every state, view-leak check from a per-game list of secret fields. Run it on Sky Team.
5. Move `packages/shared` toward `games/sky-team/rules`: decided when starting to do it in Platform 05, with the client shell.

## What was built

- `packages/engine` (`@platform/engine`): the contract in `src/index.ts`, the RNG in `src/rng.ts` (`packages/shared/src/rng.ts` re-exports it and keeps `rollDie`), and the test kit in `src/testing.ts` (`@platform/engine/testing`: `playRandomGame`, `checkReplay`, `checkGame`, `assertPlainData`).
- `packages/shared/src/definition.ts`: `skyTeam`, `skyTeamMoveSchema`, `skyTeamConfigSchema` (scenario id, `timerMs`, abilities). Exported as `@sky/shared/definition`, not from the package index, so the client bundle stays without it.
- `definition.test.ts`: the kit on every scenario (two seeds each, abilities as the scenario allows) and on timed YUL games where the scheduled `time-up` fires now and then; plus schema and seat/system checks.

## Open questions

- Assumption (to confirm): `view` takes the clock (`view(state, viewer, now)`), so Sky Team's time left in a timed round stays a pure function of its arguments. The proposal's signature had no `now`.
- Assumption (to confirm): the spectator view is not supported yet (`view` throws for `'spectator'`); it comes with the platform's rooms.
- Assumption (to confirm): the kit's random moves come from each game's own generator (`nextMove`, here the existing random agent); the contract has no "list every legal move" function, since some games (Twilight Struggle) have too many to list.

## Checklist

- [x] `packages/engine` with the contract and RNG
- [x] Sky Team move union + `moveSchema`
- [x] Sky Team `GameDefinition` adapter
- [x] Engine test kit, passing on Sky Team (every scenario)
- [x] Architecture doc and `CLAUDE.md` updated

**Done when:** the engine test kit plays every Sky Team scenario through `GameDefinition` without errors or view leaks, and all existing tests still pass unchanged. ✅ Verified (the kit plays all 40 scenarios with two seeds each and timed games with scheduled time-ups, and catches a planted leak; 398 unit and integration tests, 41 Playwright tests on three devices with 4 intentional skips; typecheck, lint, format and build pass; no existing test changed).
