# Second game 01: A second, small game

[← Second game epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **medium**

Design reference: [multi-game proposal](../../proposals/multi-game-platform.md), sections 2 and 7 (step F).

## Goals

- Prove the engine and platform with a game that differs from Sky Team where it matters: **2–4 seats** and **simultaneous secret moves**.
- Find the gaps in the contract while they are cheap to fix, before a large game.

## Feature scope

- **In:** one small game with simultaneous commit-then-reveal and N players. Which game is to be decided with the user; an original or public-domain game avoids licensing questions.
- **Out:** large games (their own epics: Pandemic, Isle of Skye, Twilight Struggle); bots.

## Technical tasks

1. Choose the game with the user; write its rules down as the spec.
2. `games/<id>/rules`: `GameDefinition`, passing the engine test kit.
3. `games/<id>/client`: `Board`, `SetupForm`, `Summary`, locales (en + vi).
4. Fix whatever the contract got wrong (record each change in the proposal).

## Checklist

- [ ] Game chosen; rules written down
- [ ] Rules module passing the engine test kit
- [ ] Client module (phone, tablet, desktop)
- [ ] Contract changes recorded in the proposal
- [ ] Playwright: a full game with 3 players

**Done when:** three players finish a game on phones, with no game-specific code in the platform packages.
