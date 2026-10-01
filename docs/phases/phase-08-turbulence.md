# Phase 8: Turbulence expansion

[← Master plan](../PLAN.md) · Milestone M3 · **Status: ⏳ Not started (scenario data drafting begun)** · Effort: **high**

## Goals

- All 20 Turbulence scenarios (10 destinations) playable online, on phone and desktop.
- New modules built as `RuleModule` hooks, without special cases in the core rules.
- Hidden information stays on the server, even for modules that hide things from players.

## Feature scope

- **In:** Turbulence, Low Visibility and Alarms modules; scenario-specific extras (e.g. the Antarctica penguin tokens); new tracks and scenarios; picker filter; UI for each module.
- **Out:** mixing expansion modules into base scenarios unless the rulebook allows it.

**Prerequisite:** the Turbulence rulebook (PDF or photos) and the printed tracks. Rules are not guessed: unclear rules are asked, not assumed.

## Technical tasks

1. Read the rulebook; write every new rule as a test case first and confirm unclear ones with the user.
2. Enter the 20 scenarios in `scenarios.ts`, tagged `expansion: 'turbulence'` (drafts for BUD, BLQ, TER, CDG, DUS, LGA and NZIR are already commented out there); add airport names.
3. Add hook points to `RuleModule` only where a module needs one (e.g. "before rolling", "is this slot blocked now?").
4. Turbulence module.
5. Low Visibility module: if it hides information, extend `viewFor` so hidden values never leave the server, with leak tests.
6. Alarms module: alarm board state, alarm tokens, blocked actions checked in `canPlaceDie` (and so highlighted correctly by `canPlaceInView`).
7. Scenario-specific extras as their own small modules.
8. UI: alarm board panel and new track art, fitting the per-seat phone order and the desktop grid.
9. Lobby: "Turbulence" filter in the scenario picker.
10. Tests: unit tests per module, fuzzing across all 41 scenarios, one Playwright game per new module.

## Checklist

- [ ] Rulebook in hand; every new rule listed as a test case and unclear rules confirmed
- [ ] 20 scenarios entered as data, tagged `expansion: 'turbulence'`, airport names added
- [ ] New `RuleModule` hook points (only those needed), with tests
- [ ] Turbulence module
- [ ] Low Visibility module, with `viewFor` leak tests if it hides information
- [ ] Alarms module: board state, tokens, blocked actions in `canPlaceDie`
- [ ] Scenario-specific extras (e.g. penguin tokens)
- [ ] UI panels for each new module, phone (per-seat order) and desktop
- [ ] "Turbulence" filter in the scenario picker
- [ ] Unit tests per module, fuzzing on all 41 scenarios, one Playwright game per new module
- [ ] Docs updated: game rules reference, protocol (if changed), `CLAUDE.md`

**Done when:** all 20 expansion scenarios play end to end on phone and desktop with tests green.

Publisher page: <https://www.scorpionmasque.com/en/sky-team-turbulence>
