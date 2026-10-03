# Game state and rules

[← Master plan](../PLAN.md)

The whole game is one serialisable `GameState` object plus pure functions that return a new state; no rule lives in React or in socket handlers.

## Files (`packages/shared/src`)

| File | Contents |
| --- | --- |
| `types.ts` | `Seat`, `SlotId`, `Phase` (`strategy` → `placing` → … → `won` / `lost`), `EndReason`, `Scenario`, `PlaceIntent`, `GameEvent`, `GameState` |
| `slots.ts` | Every slot's seat colors, allowed values and group; module slots (`module`, `coveredBy`); the 4 mandatory slots |
| `scenarios.ts` | Both altitude track sides and the Flight Log scenarios as data (`SCENARIO_LIST`, `SCENARIOS`); ids are `<airport>-<color>` |
| `state.ts` | `createGame(scenario, seed, { timerMs, abilities })`: runs each module's `setup` and the first traffic roll |
| `modules/` | One file per Flight Log module, each a `RuleModule` of hooks (see below); `MODULES`, `modulesOf(scenario)` |
| `abilities.ts` | Special Abilities: `ABILITY_IDS`, `canUseAbility` / `useAbility` (Adaptation, Anticipation, Working Together) |
| `rules.ts` | `rollDice`, `canPlaceDie`, `placeDie`, `legalMoves`, `resolveRound`, `checkLanding`, `spendReroll`, `rerollDice`, the round timer, `rollTraffic` |
| `rng.ts` | mulberry32; `rngSeed` + `rngState` live in the state, so `rngSeed` + `log` replay a game |
| `views.ts` | `PlayerView`, `viewFor(state, seat)`, `canPlaceInView` and `canUseAbilityInView` (the client's copies of the checks, read from the view) |
| `events.ts` | Socket.IO protocol types (see [protocol](protocol.md)) |
| `random-play.ts` | Random agent (`createRandomAgent`, `applyAgentAction`) and `playRandomGame`, imported as `@sky/shared/random-play`; used by fuzzing, the socket full-game test and `pnpm --filter @sky/shared random-play` |

Rule functions are pure (they return a new state). `canPlaceDie(state, seat, { dieId, slot, coffeeDelta })` returns `{ ok: true }` or `{ ok: false, reason }`; `placeDie` throws `RuleError` on an illegal move. Axis and engines resolve **as soon as the second die is placed** (as the rulebook says); `placeDie` ends the round by itself once nobody can place another die. When a round ends, its dice and speed stay in `lastRound` until the next roll. In the final round, the game ends as a win as soon as ending the round would land the plane (all landing conditions met and no end-of-round loss, e.g. Kerosene); the dice still in hand are not needed (user rule, Oct 4, 2026).

## Base-game numbers (checked against the rulebook and the physical board)

| Rule | Value |
| --- | --- |
| Axis | Tilts toward the higher die by the difference; not reset between rounds; lose on reaching 3 marks either way. Positions left to right -2 -1 0 1 2 (negative toward the pilot) |
| Aerodynamics | Blue starts between 4–5 (+1 per landing gear, 7–8 when all down); orange between 8–9 (+1 per flap, just past 12) |
| Speed | ≤ blue: 0 spaces; ≤ orange: 1 space; above: 2 spaces. Final round: compared with brakes instead |
| Landing gear | 1/2, 3/4, 5/6, any order |
| Flaps | 1/2, 2/3, 4/5, 5/6, in order |
| Brakes | 2, then 4, then 6; marker starts left of 2; landing needs speed below the marker |
| Radio | Pilot 1 space, co-pilot 2; die value N removes a plane N−1 spaces ahead of the current position |
| Coffee | +1 per concentration die, max 3, shared; each token ±1, no wrap past 1 or 6 |
| Altitude | 7 rounds, 6000 → 0; first player alternates (pilot at 6000); reroll tokens at 6000 and 2000 on the green/yellow side (`BASE_ALTITUDES`), at 6000 only on the red/black side (`HARD_ALTITUDES`) |
| Collision / overshoot | Advancing with planes in the current position, or from the airport, loses |

## Optional round timer (online extra)

The game creator can turn on a timer in the lobby (off by default). From the roll until the round's last die is placed the players have `ROUND_TIMER_MS` (3 minutes); if it runs out, the game is lost (`endReason: 'time-up'`). `GameState.timerMs` holds the setting and `deadline` the running round's end; `startRoundTimer(state, now)` starts it after `rollDice`, `expireRoundTimer(state, now)` ends the game once `now` reaches the deadline, and ending the round or the game clears it. The server keeps one timeout per room (`syncRoundTimer`) and also checks the deadline before every move. Views carry `timerMs` and `roundTimeLeftMs` (relative, so a wrong device clock does not matter).

## Flight Log scenarios and modules

A `Scenario` has an airport, a color (`green` Routine, `yellow` Exceptional, `red` Elite, `black` Heroic), its altitude track (green/yellow or red/black side), its approach track (`approach` planes, optional `traffic` icons and `turns`), its `modules` and how many Special Ability cards the players choose. Modules are `RuleModule` objects in `packages/shared/src/modules`; the rules call their hooks at fixed points (`altitudes`, `dicePerRound`, `approachPerRound`, `waivedLanding`, `alarmTokens`, `setup`, `startOfRound`, `checkAnySlot`, `checkSlot`, `checkMove`, `place`, `afterAxis`, `speedBonus`, `endOfRound`, `landing`, `brakeThresholds`, `timeUpEndsRound`) and a module only reacts to its own slots. `rules.ts` never tests for a module by name. Module state lives in `GameState` (`kerosene`, `intern`, `wind`) and is public in the view.

| Module / effect | Rule as implemented |
| --- | --- |
| Kerosene | Marker starts at 20. A die of any value on the Kerosene space (either player) burns its value; a round without one burns 6 at the very end of the round. Reaching 0 (the X) at any time loses (`kerosene`) |
| Kerosene leak | Same track, no Kerosene space; each round burns \|pilot engine − co-pilot engine\| + 1 |
| Intern | Six tokens 1–6 in a seeded random order. A die (any value, but not the next token's) on your Intern space takes the token nearest your side; the token goes on a space you could fill, as a die of its number (no coffee, not Concentration). One move: `game:place { …, tokenSlot }`. Tokens left at landing lose (`landing-intern`) |
| Wind | The Wind Ring has 20 spaces: +3 at the white centre, then 3, 2, 2, 1, 0, −1, −2, −2, −3, −3 (opposite), −3, −2, −2, −1, 0, 1, 2, 2, 3 clockwise (`WIND_RING`, confirmed from the ring Oct 1, 2026). The blue airplane starts at the white centre (index 0). After each Axis phase it turns as many spaces as the axis is off centre, to the side it tilts (negative, toward the pilot = left), even if the axis did not move; its wind speed is added to the engines every round, the last one included |
| Real-time | 60 s from the roll (`REAL_TIME_MS`, overrides the lobby timer); when it runs out the round ends and unplaced dice are lost; missing axis/engine dice lose as usual |
| Ice brakes | Replace the brakes: columns 2, 3, 4, 5, each needing two dice of that value in one round, above (pilot) and below (either player), left to right; the marker may pass several columns in a round. A lone die is lost at the round's end. Landing needs the marker past 5 (`landing-ice-brakes`) and speed ≤ 5 |
| Wind upside down | Turbulence (NZIR): the Wind module placed the other way round. The airplane starts on the opposite space (`WIND_REVERSED_START` = 10, a −3); the ring is symmetric, so every speed is reversed (headwinds). It turns with the axis like Wind. The ring is drawn with that space at the top |
| Start at 5000 ft | Turbulence: the game starts on the 5000 space (the module's `altitudes` hook drops the 6000 space in `createGame`): no starting reroll token, one round fewer, and the 5000 space says who plays first |
| Engines out | Turbulence (TER, yellow and black): the Engine spaces are covered (`coveredBy`), so no dice there, no speed and Engines are not mandatory; the Engines panel is hidden. Each player places only 3 of their 4 dice a round (`dicePerRound`, error `dice-limit`; the 4th is lost). At the end of every round but the final one the Approach Track advances one space (`approachPerRound`): planes still on the space are a collision and turns apply, as usual. Landing skips the speed check (`waivedLanding: landing-brakes`): with Ice brakes, the marker past 5 is enough (confirmed with the user Oct 1, 2026) |
| Altitude tracks A–D | Turbulence: `altitudeTrack` on a scenario picks `ALTITUDE_TRACKS` A or B (green/yellow side) or C or D (red/black side), with weather on some altitudes (A: Bad Visibility 4000–1000; B: Turbulence 5000–2000; C: Turbulence 5000, 4000, Bad Visibility 3000–1000; D: Turbulence 5000, 4000, both at 3000 and 2000, Bad Visibility at 0; confirmed Oct 2, 2026). **Turbulence:** after each of a player's own dice, their remaining dice are rerolled. **Bad Visibility:** each player rolls 2 dice and sets 2 aside (`setAside`); each of their next two placements brings in one, freshly rolled (the kept die is not rerolled). **Both:** the new die comes in and both dice in hand are rolled; with nothing left aside, each placement rerolls the last die. Placing on an Alarm token counts; the Synchronization traffic die does not |
| Alarms | Turbulence: 6 tokens face down (`GameState.alarms`). At the start of each round, each Alarm symbol on the current approach space (`scenario.alarms`) flips a random face-down token: its Action's spaces refuse dice (`alarm-blocked`) until the die printed on the token is placed on its Alarm board space (the partner's colour, coffee allowed): Concentration 1 (either), Brakes orange 2, Landing gear orange 3, Flaps blue 4, Pilot radio orange 5, Co-pilot radio blue 6. That die is used up for the round and the token is removed. Alarms never prevent a landing |
| Total Trust | Turbulence: a round that ends on a Total Trust space (`scenario.totalTrust`) makes the next round skip the strategy discussion (`autoRoll`): no "Roll dice", the server rolls after the 5 s pause. Never in round 1 |
| Belly landing | Turbulence (WAW): the Landing Gear spaces are covered, the blue marker never moves, and landing does not need the gear (`waivedLanding`); only the Flaps, Co-pilot radio and Concentration Alarm tokens are used (`alarmTokens`) |
| Traffic die | At the start of each round (round 1 included), one roll of the traffic die (2, 3, 3, 4, 4, 5) per icon on the current space adds a plane that many spaces ahead, counting the current one (beyond the track: the airport), while the box (12 planes) has any. Radio-cleared planes go back to the box. The round's rolls are kept in `traffic` and shown to both players |
| Turns | Every space the plane flies out of when the track advances checks the axis against its permitted positions; outside them loses (`turn`). No advance, no check |

**Special Abilities** (the lobby picks as many as the scenario allows): **Control** (two equal Axis dice: +1 coffee) and **Mastery** (two equal Engine dice: +1 reroll token if one of the 3 is still in the box, not on the altitude track or in the supply) trigger by themselves; **Synchronization** rolls the traffic die once per round when that round has dice on both Landing Gear and Flaps, and the co-pilot must place it at once on any empty Control Panel space, any color, no coffee (an extra action; the turn then continues as before); **Adaptation** (once per game each, flip one of your dice to its opposite side), **Anticipation** (each round the first player may reroll one die before placing their first) and **Working Together** (once per round: offer a die; the partner must answer with one; the values swap; nobody places meanwhile) are `game:ability` actions.

## Data still to verify

Approach tracks are entered from the physical tiles in `scenarios.ts` (all 40 scenarios, Oct 2, 2026). Confirmed from the physical pieces (Oct 1, 2026): the Wind Ring (`WIND_RING`) and the red/black altitude track (`HARD_ALTITUDES`).

## Assumptions to revisit

- Turns check the space the plane flies out of (both spaces when advancing 2), not the one it arrives on.
- Synchronization triggers once per round, the traffic die cannot take coffee and cannot go on the Kerosene or Intern boards.
- Abilities are chosen by whoever creates the game (or presses "Fly again"); Adaptation may be used at any time while dice are being placed.
- Radio-cleared planes return to the box, so the traffic die can reuse them.
- If the seat on turn has no legal placement, the turn passes to the partner; if neither can place, the leftover dice are lost and the round ends (the rulebook does not cover this).
- Placing on a flap or brake that is already deployed is allowed and has no effect (the rulebook says so for landing gear).
