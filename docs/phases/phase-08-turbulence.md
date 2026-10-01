# Phase 8: Turbulence expansion

[← Master plan](../PLAN.md) · Milestone M3 · **Status: 🚧 In progress (rulebook studied, questions open)** · Effort: **high**

## Goals

- All 20 Turbulence scenarios (10 destinations) playable online, on phone and desktop.
- New modules built as `RuleModule` hooks, without special cases in the core rules.
- Hidden information stays on the server, even for modules that hide things from players.

## Feature scope

- **In:** Altitude 5000, Total Trust, Alarms and Altitudes A–D (Turbulence and Bad Visibility events) modules; scenario-specific rules (TER engines out, WAW belly landing, NZIR reversed wind and penguin tokens); new tracks and scenarios; picker filter; UI for each module.
- **Out:** mixing expansion modules into base scenarios unless the rulebook allows it.

**Prerequisite:** the Turbulence rulebook (PDF or photos) and the printed tracks. Rules are not guessed: unclear rules are asked, not assumed.

## Rulebook summary (studied 2026-10-01)

Source: [Sky Team: Turbulence rules (EN, 21 Aug 2024)](https://www.scorpionmasque.com/sites/scorpionmasque.com/files/st-ex_rules_en_21aug2024.pdf). The real module list differs from the earlier plan (there is no separate "Low Visibility" module; Turbulence and Bad Visibility are events on new altitude tracks).

**Contents:** Alarm board, 6 Alarm tokens, 6 Penguin tokens, 2 double-sided Altitude tracks (A/B, C/D), 10 Approach tracks, 2 spare switches.

- **Altitude 5000:** the game starts with the 5000 space in the Current Altitude space instead of 6000: no starting reroll token and one round fewer.
- **Total Trust:** if the Total Trust symbol is in the Current Position space at the end of the round, the next round skips the Strategy Discussion: players just roll.
- **Alarms:** the Alarm board sits next to the Control Panel with the 6 tokens shuffled face down. If an Alarm symbol is in the Current Position space at the beginning of a round, flip any token face up: that Action can no longer be used until the token is removed; "a die placed on a space affected by an Alarm will have no effect". A die of the right colour and number placed on the token removes it, together with the die (that die is out for the round). No tokens left to flip: nothing happens. Active Alarms do not prevent landing. An Alarm on Concentration stops new coffee; coffee already earned can still be used. Tokens (the colour is the *other* seat for a seat's own action):

  | Token | Blocks | Cleared by |
  | --- | --- | --- |
  | Concentration | Concentration | 1, either colour |
  | Brakes | Brakes | orange 2 |
  | Landing Gear | Landing gear | orange 3 |
  | Flaps | Flaps | blue 4 |
  | Pilot Radio | Pilot radio | orange 5 |
  | Co-Pilot Radio | Co-pilot radio | blue 6 |

- **Altitudes A, B, C, D:** a replacement Altitude track. When the Current Altitude space shows an event, it applies that round:
  - **Turbulence:** every time you place a die on an Action, reroll all your remaining dice.
  - **Bad Visibility:** both players roll only 2 dice and set 2 aside; the next two times you place a die on an Action, roll one set-aside die and add it (the die you kept is not rerolled). Never more than 2 dice to choose from.
  - **Turbulence + Bad Visibility:** as Bad Visibility, but when you take the new die, roll both of your available dice.
  - Track A, as drawn in the contents picture (to confirm on the tile): 6000 reroll, 5000 none, 4000 Bad Visibility, 3000 Bad Visibility, 2000 Bad Visibility + reroll, 1000 Bad Visibility. B, C, D are not readable in the rulebook.
- **Scenario-specific (book icon):**
  - **TER Lajes:** two face-down Intern tokens on each Engine space: no dice there, and Engines are no longer mandatory. Both players roll 4 dice but use only 3. At the end of every round, the Approach and Altitude tracks each advance one space. (Its scenarios also use Ice brakes: a stronger braking system.)
  - **WAW Warsaw:** 3 face-down Intern tokens on the Landing Gear spaces: no dice there, the blue Aerodynamics marker stays at 5, and the gear is not needed to land. Only the Flaps, Co-Pilot Radio and Concentration Alarm tokens are used.
  - **NZIR Ice Runway:** the Wind module is placed the other way round (arrows pointing down: headwinds), and Penguin tokens replace the Airplane tokens on the Approach track.
- **Scenarios (20, 10 destinations):** CPT, SYD, PEK, KBP (green/yellow), TER, WAW, SXM, DUS, MAD (yellow/red), SYD, DUS, NZIR, PEK, WAW (red), MAD, TER, KBP, CPT, NZIR (black). Each card lists its modules by icon (Altitude A–D, 5000, Total Trust, Alarms, traffic, Intern, Kerosene leak, Real-time, Ice brakes, Wind, book) and its number of Special Abilities. Track data comes later from the physical tiles.

## Open questions (to confirm with the user)

1. Alarms: on a blocked Action, can a die still be placed (with no effect), or can no die go there at all?
2. Alarms: is the flipped token random (they are shuffled face down)? May coffee change a die to match a token? Does a die placed on an Alarm token count as "placing on an Action" for Turbulence?
3. Total Trust in the app (no in-app talking): skip the "Roll dice" step and roll automatically when the next round starts (after the 5 s countdown)?
4. Altitude tracks: confirm A and give B, C, D (event and reroll icon per altitude) from the tiles.
5. Turbulence + Bad Visibility: once the set-aside dice are used up, does each placement still reroll your last remaining die?
6. ~~TER: speed at landing, collisions, the fourth die?~~ Settled with the user (Oct 1, 2026): no speed check (Ice brakes past 5 is enough); planes left on the space still collide; the fourth die is unused. Built as the `engines-out` module.
7. ~~NZIR: what does the reversed Wind module change?~~ Settled: the airplane starts on the opposite ring space, and the ring is symmetric, so every speed is negated. Built as the `wind-reversed` module (Oct 1, 2026), with `altitude-5000`.
8. NZIR: do Penguins follow every Airplane rule (radio clears them, collision when advancing)?

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
