# Phase 8: Turbulence expansion

[← Master plan](../PLAN.md) · Milestone M3 · **Status: 🚧 In progress (rules and UI built Oct 3, 2026; waiting for the 16 scenarios)** · Effort: **high**

## Goals

- All 20 Turbulence scenarios (10 destinations) playable online, on phone and desktop.
- New modules built as `RuleModule` hooks, without special cases in the core rules.
- Hidden information stays on the server, even for modules that hide things from players.

## Feature scope

- **In:** Altitude 5000, Total Trust, Alarms and Altitudes A–D (Turbulence and Bad Visibility events) modules; scenario-specific rules (WAW belly landing); new tracks and scenarios; UI for each module (no picker filter). Already built before this phase, so out of scope here: TER (`engines-out`) and NZIR (`wind-reversed`).
- **Out:** mixing expansion modules into base scenarios unless the rulebook allows it.

**Prerequisite:** the Turbulence rulebook (PDF or photos) and the printed tracks. Rules are not guessed: unclear rules are asked, not assumed.

## Rulebook summary (studied 2026-10-01)

Source: [Sky Team: Turbulence rules (EN, 21 Aug 2024)](https://www.scorpionmasque.com/sites/scorpionmasque.com/files/st-ex_rules_en_21aug2024.pdf). The real module list differs from the earlier plan (there is no separate "Low Visibility" module; Turbulence and Bad Visibility are events on new altitude tracks).

**Contents:** Alarm board, 6 Alarm tokens, 6 Penguin tokens, 2 double-sided Altitude tracks (A/B, C/D), 10 Approach tracks, 2 spare switches.

- **Altitude 5000:** the game starts with the 5000 space in the Current Altitude space instead of 6000: no starting reroll token and one round fewer.
- **Total Trust:** if the Total Trust symbol is in the Current Position space at the end of the round, the next round skips the Strategy Discussion: players just roll.
- **Alarms:** the Alarm board sits next to the Control Panel with the 6 tokens shuffled face down. If an Alarm symbol is in the Current Position space at the beginning of a round, flip any token face up: that Action can no longer be used until the token is removed; "a die placed on a space affected by an Alarm will have no effect". A die of the right color and number placed on the token removes it, together with the die (that die is out for the round). No tokens left to flip: nothing happens. Active Alarms do not prevent landing. An Alarm on Concentration stops new coffee; coffee already earned can still be used. Tokens (the color is the *other* seat for a seat's own action):

  | Token | Blocks | Cleared by |
  | --- | --- | --- |
  | Concentration | Concentration | 1, either color |
  | Brakes | Brakes | orange 2 |
  | Landing Gear | Landing gear | orange 3 |
  | Flaps | Flaps | blue 4 |
  | Pilot Radio | Pilot radio | orange 5 |
  | Co-Pilot Radio | Co-pilot radio | blue 6 |

- **Altitudes A, B, C, D:** a replacement Altitude track. When the Current Altitude space shows an event, it applies that round:
  - **Turbulence:** every time you place a die on an Action, reroll all your remaining dice.
  - **Bad Visibility:** both players roll only 2 dice and set 2 aside; the next two times you place a die on an Action, roll one set-aside die and add it (the die you kept is not rerolled). Never more than 2 dice to choose from.
  - **Turbulence + Bad Visibility:** as Bad Visibility, but when you take the new die, roll both of your available dice.
  - Track A (confirmed by the user Oct 2, 2026): 6000 reroll, 5000 none, 4000 Bad Visibility, 3000 Bad Visibility, 2000 Bad Visibility + reroll, 1000 Bad Visibility.
  - Track B (confirmed by the user Oct 2, 2026): the same as `BASE_ALTITUDES` (first player alternating, rerolls at 6000 and 2000), with Turbulence at 5000, 4000, 3000 and 2000.
  - Track C (confirmed by the user Oct 2, 2026): Turbulence at 5000 and 4000; Bad Visibility at 3000, 2000 and 1000.
  - Track D (confirmed by the user Oct 2, 2026): Turbulence at 5000 and 4000; Turbulence and Bad Visibility together at 3000 and 2000; Bad Visibility at 0 (the final round).
  - Rerolls and first players (confirmed by the user Oct 2, 2026): tracks A and B follow `BASE_ALTITUDES` (rerolls at 6000 and 2000); tracks C and D follow `HARD_ALTITUDES` (reroll only at 6000).
- **Scenario-specific (book icon):**
  - **WAW Warsaw:** 3 face-down Intern tokens on the Landing Gear spaces: no dice there, the blue Aerodynamics marker stays at 5, and the gear is not needed to land. Only the Flaps, Co-Pilot Radio and Concentration Alarm tokens are used.
- **Scenarios (16 left to build, 8 destinations):** CPT, SYD, PEK, KBP (green/yellow), WAW, SXM, DUS, MAD (yellow/red), SYD, DUS, PEK, WAW (red), MAD, KBP, CPT (black). TER and NZIR (4 scenarios) are already in `scenarios.ts`. Each card lists its modules by icon (Altitude A–D, 5000, Total Trust, Alarms, traffic, Intern, Kerosene leak, Real-time, Ice brakes, Wind, book) and its number of Special Abilities. Track data comes later from the physical tiles.

## Open questions

1. ~~Alarms: can a die go on a blocked Action?~~ Settled with the user (Oct 3, 2026): no. While its Alarm token is face up, no die can be placed on that Action's spaces (only the matching die on the token itself, which clears it).
2. ~~Alarms: random token, coffee, Turbulence?~~ Settled with the user (Oct 3, 2026): the flipped token is random (the game picks one of the face-down tokens), and coffee may change a die to match a token. A die placed on an Alarm token counts as placing on an Action, so Turbulence rerolls your remaining dice.
3. ~~Total Trust in the app~~ Settled with the user (Oct 3, 2026): no "Roll dice" step; the next round rolls automatically when the 5 s "Next turn" countdown ends.
4. ~~Altitude tracks A–D~~ Settled with the user (Oct 2, 2026), rerolls included.
5. ~~Turbulence + Bad Visibility after the set-aside dice run out~~ Never more than 2 dice in hand; each time you take a set-aside die to replace the one you placed, roll both dice in hand. Once no set-aside dice are left, each placement still rerolls your remaining die (Oct 3, 2026).
6. **Assumption (to confirm):** Turbulence and Bad Visibility act after a player places one of their own dice, not after the co-pilot places the black traffic die (Synchronization). Training the intern (a die on the Intern space, then its token on the board) counts as one placement.
7. **Assumption (to confirm):** an Intern token can clear an Alarm, since it is placed like a die of its number (same colour rule: the token is the placing player's colour).
8. **Assumption (to confirm):** Bad Visibility: if neither die in your hand can be placed, your turn is skipped as usual, and your set-aside dice are lost for the round (they only come in after a placement).
9. **Assumption (to confirm):** an Alarm symbol flips a token at the start of every round the plane is on that space, the first round included (the rulebook says "at the beginning of a round"; traffic icons work the same way). The entered data supports it: SYD green, SYD red, CPT black and KBP black print Alarm symbols on the starting space, which would only matter in round 1 if the plane never moved.
10. ~~Total Trust on the starting space in round 1~~ Settled by the data (Oct 3, 2026): no scenario has a Total Trust symbol on its starting space, so it never comes up.
11. ~~The Brakes alarm and Ice brakes~~ Settled by the data (Oct 3, 2026): no scenario combines Alarms with Ice brakes; the Brakes alarm blocks the three Brakes spaces.

## Technical tasks

1. ✅ Read the rulebook; write every new rule as a test case first and confirm unclear ones with the user.
2. Enter the 16 remaining scenarios in `ENTRIES` (`scenarios.ts`), with the `Entry` fields `altitudeTrack` ('A'–'D'), `alarms` and `totalTrust` (symbols per approach space, like `traffic`) (these two switch on the Alarms and Total Trust modules by themselves: never list them in `modules`) and the modules `'belly-landing'`, `'altitude-5000'`; add airport names. When an airport and colour appear more than once, ids are numbered automatically: `dus-red1`, `dus-red2` (in `ENTRIES` order). **The user enters these.**
3. ✅ Hooks added to `RuleModule`: `startOfRound` (Alarms, Total Trust), `checkAnySlot` (an Alarm blocks core spaces), `waivedLanding` (replaces `noSpeed`; Engines out, Belly landing), `alarmTokens` (Belly landing keeps 3 tokens); `setup` now gets every module in play.
4. ✅ Altitude tracks A–D (`ALTITUDE_TRACKS`), with `turbulence` / `badVisibility` on `AltitudeSpace`; Turbulence and Bad Visibility in the core rules (`rollDice`, then `weather` after each of a player's own dice); `setAside` counts in the state and view. Nothing new is hidden: set-aside dice are rolled only when they come in.
5. ✅ Alarms module: face-up and face-down tokens in `GameState.alarms` (public: the flip is random when it happens), six alarm token slots, blocked Actions refused in `checkPlacement` (so `canPlaceInView` lights spaces correctly).
6. ✅ Total Trust module (`autoRoll`) and the server's automatic roll after the pause (`syncRoundTimer` → `scheduleAutoRoll`, `NEXT_TURN_MS`).
7. ✅ Belly landing module (WAW): Landing gear covered, landing without gear, 3 alarm tokens.
8. ✅ UI: Alarm board panel, red bell on blocked spaces, stuck gear, weather icons on the altitude track, Alarm and Total Trust symbols on the approach track, weather notes and set-aside dice in the tray, no "Roll dice" under Total Trust.
9. Tests: unit tests per module ✅, fuzzing on test scenarios with every feature ✅, one Playwright game (Alarms) ✅; fuzzing on the 16 real scenarios once they are entered.

## Checklist

- [x] Rulebook in hand; every new rule listed as a test case and unclear rules confirmed (assumptions 6–9 still to confirm)
- [x] 16 scenarios entered in `ENTRIES` by the user (Oct 3, 2026); airport names added for CPT, SYD, PEK, KBP, WAW, SXM, MAD
- [x] New `RuleModule` hook points (only those needed), with tests
- [x] Altitude tracks A–D: Turbulence, Bad Visibility, both together
- [x] Alarms module: board state, tokens, blocked actions in `canPlaceDie`
- [x] Total Trust module, with the server's automatic roll
- [x] Scenario-specific: WAW belly landing (TER and NZIR were built earlier)
- [x] UI for each new module, phone (per-seat order) and desktop
- [x] Unit tests per module, fuzzing with every feature, one Playwright game (Alarms)
- [x] Fuzzing (100 games each, 56 scenarios) and a prepared-final-round win on every scenario
- [x] Docs updated: game rules reference, protocol, UI, `CLAUDE.md`

**Done when:** all 20 expansion scenarios play end to end on phone and desktop with tests green.

Publisher page: <https://www.scorpionmasque.com/en/sky-team-turbulence>
