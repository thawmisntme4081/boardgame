# Phase 1: Core rules in `shared`

[← Master plan](../PLAN.md) · Milestone M1 · **Status: ✅ Done (Sep 28, 2026)**

## Goals

- The whole base game as pure, tested functions, before any networking.
- A deterministic, replayable game: seeded RNG, every move logged.

## Feature scope

- **In:** game state and types, dice, every cockpit slot, coffee, rerolls, round resolution, crash checks, landing, random-play fuzzing, the YUL scenario.
- **Out:** server, UI, other airports and modules.

## Technical tasks

1. Types for state, slots, dice and events (`types.ts`, `slots.ts`).
2. mulberry32 RNG with `rngSeed`/`rngState` in the state; `createGame(scenario, seed)`.
3. `canPlaceDie` / `placeDie` for every slot type; coffee earn/spend.
4. Round resolution: axis, speed vs aero markers, approach movement, altitude; crash checks; `checkLanding`.
5. Reroll tokens (spend one, then both players may reroll once).
6. Random agent + `random-play` script; fast-check fuzz test (1,000 games).

## Checklist

- [x] Types for state, slots, dice, events
- [x] Seedable RNG and `createGame`
- [x] `canPlaceDie` / `placeDie` for every slot type
- [x] Coffee: earn on concentration, spend for ±1
- [x] `resolveRound`: axis, speed from engines vs aero markers, approach movement, altitude
- [x] Crash checks: axis out of range, moving into planes, overshooting, missing the airport, empty mandatory spaces
- [x] `checkLanding` win conditions
- [x] Reroll tokens (spend one, then both players may reroll once)
- [x] Script that plays random legal moves to the end, 1,000 times (`pnpm --filter @sky/shared random-play`, plus a fast-check fuzz test)
- [x] Replace the placeholder YUL approach track with the real plane counts

**Done when:** unit tests cover every rule and the random-play script never throws. ✅ Verified Sep 28, 2026: 69 tests pass, including 1,000 fuzzed games.

See [game rules reference](../reference/game-rules.md) for the numbers as implemented.
