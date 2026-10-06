# Epic: Second game (small)

[← Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Game: to be chosen with the user

## Goal

Prove the platform with a small game that differs from Sky Team where it matters: **2–4 seats** and **simultaneous secret moves**. Find the gaps in the engine contract while they are cheap to fix, before a large game. An original or public-domain game avoids licensing questions.

**Epic done when:** three players finish a game on phones, with no game-specific code in the platform packages.

## Phases

| # | Phase | Status | Effort |
| --- | --- | --- | --- |
| 01 | [The whole game: rules, client, tests](phase-01-second-game.md) | ⏳ Not started | Medium |

A small game fits in one phase. If it grows (variants, expansions, more languages), add phases following the [game epic template](../../PLAN.md#game-epic-template).

## Order and dependencies

- Needs [Platform 01–05](../platform/EPIC.md) (contract, moves, protocol, match log, client shell).
- Layout (from Platform 05): the game lives in `games/<id>/rules` (its `GameDefinition`, run by the engine kit) and `games/<id>/client` (a `GameClientModule`: `Board`, `SetupForm`, `WaitingInfo`, `locales` as the `<id>` namespace, `styles.css`), registered in `packages/server/src/games.ts` and `packages/web/src/games.ts` (plus the platform's `games.<id>` texts for the picker, and an `@import` / `@source` in `packages/web/src/index.css`). Sky Team is the example to copy.
- Comes before the large-game epics.
