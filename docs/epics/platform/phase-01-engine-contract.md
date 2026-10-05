# Platform 01: Engine contract

[← Platform epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **low-medium**

Design reference: [multi-game proposal](../../proposals/multi-game-platform.md), sections 4.1 and 4.6 (step A).

## Goals

- One game-agnostic interface, `GameDefinition`, that every game implements and the platform depends on.
- Sky Team runs through it with **no behaviour change**.

## Feature scope

- **In:** a new `packages/engine` (the `GameDefinition` types, `Actor`, `Outcome`, `Result`, the seeded RNG moved from shared); a Sky Team adapter (`setup = createGame`, `apply` = dispatch over a Sky Team move union, `view = viewFor`, `outcome` from the phase); the engine test kit.
- **Out:** protocol changes (Platform 03); moving timers into the game (Platform 02); new repository layout for the client (Platform 05).

## Technical tasks

1. Create `packages/engine` with `GameDefinition<S, M, V, C>`, `Actor` (`turn`, `simultaneous`, `prompt`), `ScheduledMove`, `Outcome`, `SeatId`, and the RNG.
2. Define Sky Team's move union (`place`, `spend-reroll`, `reroll`, `ability`, `ready`, `pick-ability`, `confirm`) with one Zod `moveSchema`.
3. Write the Sky Team definition as an adapter over the existing rule functions (no rule rewrites); `actors` from `phase`, `currentSeat` and `rerollPending`.
4. Engine test kit: random play through `GameDefinition` only, determinism (same seed and moves → same state), JSON round trip of every state, view-leak check from a per-game list of secret fields. Run it on Sky Team.
5. Move `packages/shared` towards `games/sky-team/rules` (the move can happen here or in Platform 05; decide when starting).

## Checklist

- [ ] `packages/engine` with the contract and RNG
- [ ] Sky Team move union + `moveSchema`
- [ ] Sky Team `GameDefinition` adapter
- [ ] Engine test kit, passing on Sky Team (every scenario)
- [ ] Architecture doc and `CLAUDE.md` updated

**Done when:** the engine test kit plays every Sky Team scenario through `GameDefinition` without errors or view leaks, and all existing tests still pass unchanged.
