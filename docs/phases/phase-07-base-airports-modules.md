# Phase 7: Base game airports and modules

[← Master plan](../PLAN.md) · Milestone M2 · **Status: ✅ Done (Sep 30, 2026; scenario data completed Oct 2, 2026)**

## Goals

- The whole base box: every Flight Log scenario, module and Special Ability, playable online.
- A module hook system the expansion (Phase 8) can build on without touching core rules.
- Game UI polished enough for regular play on phones.

## Feature scope

- **In:** `RuleModule` hook system; Kerosene, Kerosene leak, Intern, Wind, Real-time, Ice brakes; Traffic die and Turns on the approach track; the six Special Abilities; scenario data; scenario picker; module UI on phone and desktop.
- **Out:** Turbulence expansion content (Phase 8).

## Technical tasks

1. `RuleModule` hooks in `packages/shared/src/modules` (`setup`, `checkSlot`, `checkMove`, `place`, `afterAxis`, `speedBonus`, `endOfRound`, `landing`, `brakeThresholds`, `timeUpEndsRound`); module slots declare `module` / `coveredBy` in `slots.ts`.
2. One file per module, each with unit tests; approach effects (traffic die, turns) in `rules.ts`.
3. Special Abilities: automatic ones in the rules, action ones via `game:ability` (`abilities.ts`).
4. Scenario data in `scenarios.ts` (ids `<airport>-<color>`); both altitude track sides.
5. Server: `room:create` and `game:rematch` take `scenario` and `abilities`; Zod validation.
6. Client: `ScenarioPicker` (lobby + game over), module panels, ice brakes, traffic/turn marks, traffic die in the co-pilot's tray, ability buttons.
7. Random-play fuzzing on every scenario; a "winnable from a prepared final round" test per scenario.

## Checklist

- [x] Module hook system: each module is a `RuleModule` with its own state and hooks
- [x] Scenario data structure for all base-box airports and scenarios (colors, modules and ability counts from the Flight Log cards)
- [x] Base modules as rule hooks, each with tests: Kerosene, Kerosene leak, Intern, Wind, Real-time, Ice brakes; approach effects Traffic die and Turns; the six Special Abilities
- [x] Scenario picker in the lobby (grouped by color, modules explained, ability chips), shown in the waiting room and after a game ("Fly again" may switch scenario)
- [x] UI for each module on phone and desktop
- [x] Enter every scenario's approach track from the printed tiles: 40 scenarios on 18 airports, none left commented out (entered by the user, Oct 2, 2026)
- [x] Read the Wind Ring values off the ring (`WIND_RING`: 20 spaces, +3 at the white centre down to −3 opposite; confirmed Oct 1, 2026)
- [x] Read the red/black altitude track (`HARD_ALTITUDES`: like the green/yellow side, with a reroll only at 6000; confirmed Oct 1, 2026)

**Done when:** every base scenario plays end to end and random-play fuzzing passes on all of them. ✅ Verified Sep 30, 2026 with placeholder tracks (2,100 fuzzed games, every scenario won from a prepared final round, Playwright Kerosene and Intern games on three devices). ✅ Re-verified Oct 2, 2026 with the real tracks: 40 scenarios, 4,000 fuzzed games (100 per scenario) with no errors, every scenario won from a prepared final round, 292 unit tests and 32 Playwright tests on three devices.

## Also delivered (online extras and UX polish, Sep 29 – Oct 1, 2026)

- [x] Optional round timer: lobby switch (off by default), 3 minutes per round from the roll, time up = game lost; enforced by the server; kept on rematch
- [x] "Next turn in 5s" pause: the only status pill for 5 s after a round's last die; the board keeps showing the finished round (`lastRound`); "Roll dice" is disabled until it ends
- [x] Traffic die rolls shown in the strategy tray, with the new planes outlined on the track
- [x] Turn dots over the axis dial; wind amount ("+N wind") over the engines; Wind ring beside/above the Axis panel
- [x] Axis positions read −2 … 2 left to right (negative toward the pilot)
- [x] Win and loss dialogs clearly different (green/red band, icon, reasons)
- [x] Marker badges next to panel titles (brake marker +2, aerodynamics markers +1); kerosene burn "−N" animation; ice brake bars fill in; intern token arrows
- [x] Status bar: red "No talking" pill while dice are placed; Leave button turns red on hover
- [x] Dice tray in two columns (status and dice left; coffee, rerolls, abilities right); "Roll dice" moved into the tray; ability names open a popover with their rule
- [x] Sticky status bar and dice tray instead of a fixed `100dvh` page
- [x] Cockpit order below desktop depends on the seat (your own systems first)
- [x] Board animations kept (sliding markers, fading planes)
- [x] Tests independent of which scenarios are active

See [game rules reference](../reference/game-rules.md) for every module rule and the open assumptions.
