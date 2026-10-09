# Pandemic: game state and rules

[← Master plan](../PLAN.md) · [Pandemic epic](../epics/pandemic/EPIC.md) · Sky Team's rules: [game-rules.md](game-rules.md)

The spec is the rulebook in `docs/rulebooks/pandemic_rules.pdf` (Z-Man, 2013 edition, © 2015 printing; kept out of git). As for Sky Team, the whole game is one plain-JSON `GameState` plus pure functions that return a new state; no rule lives in React or in socket handlers. Roles (Pandemic 04) and events (Pandemic 05) exist only as ids so far.

## Files (`games/pandemic/rules/src`)

| File | Contents |
| --- | --- |
| `cities.ts` | The 48 cities: `color`, `links` (the white lines, Pacific ones included, in a fixed order; where each city sits on the map picture is the client's `lib/mapGeometry.ts`); `cityOf`, `areLinked`, `PACIFIC_LINKS`. Written from the standard board (the rulebook's text has none of it); to be checked against the physical board |
| `types.ts` | `SeatId` (`p1`–`p4`), the rulebook's numbers, `EVENT_IDS`, `ROLE_IDS`, `PlayerCard` / `HandCard`, `Turn`, `Pending`, `GameState`; `ActionState` (the fields the move checks read: a state or a view) |
| `setup.ts` | `createGame({ seats, epidemics, seed })`, the seeded `shuffle`, `pileSizes` |
| `actions.ts` | The actions: `checkAction` (a reason code), `applyAction`, `spendAction`, `cubesOnBoard`, `cardsToCure` |
| `share.ts` | Share Knowledge as an offer and an answer: `checkShare`, `applyShare`, `shareAnswerer` |
| `outbreak.ts` | `infectCity` (infections, epidemics, outbreaks and chain reactions), `lose` |
| `turn.ts` | The steps after the actions: `draw`, `epidemic`, `infect`, `discard` (`checkTurnMove`, `applyTurnMove`) |
| `moves.ts` | `PandemicMove`, `checkMove` / `applyMove` (one entry for every move), `canActInView` (the client's copy of the checks, read from a view) |
| `legal.ts` | `candidateActions`, `legalActions`, `legalShareOffers` |
| `views.ts` | `PandemicView`, `viewFor(state, viewer)` |
| `outcome.ts` | `outcome(state)`: won, or lost with `outbreaks`, `cubes` or `player-deck` |
| `definition.ts` | `pandemic`, the `GameDefinition` (imported only as `@pandemic/rules/definition`), `pandemicMoveSchema`, `pandemicConfigSchema` |
| `random-play.ts` | `agentMove`, a random player with a taste for useful moves (imported as `@pandemic/rules/random-play`); used by the engine kit and `pnpm --filter @pandemic/rules random-play` |
| `test-utils.ts` | `blankGame` (a seeded game with an empty board), `addCubes`, `give`, `city` |

## Numbers (from the rulebook)

| Rule | Value |
| --- | --- |
| Players, hands | 2–4 players; starting hands of 4 / 3 / 2 cards |
| Epidemics | 4 (introductory), 5 (standard), 6 (heroic); the other cards split into that many equal piles (larger piles on top), one epidemic shuffled into each |
| Setup infections | 9 cities: 3 with 3 cubes, 3 with 2, 3 with 1; a research station and every pawn in Atlanta |
| Turn | 4 actions, draw 2 player cards, infect cities |
| Infection rate | 2, 2, 2, 3, 3, 4, 4 |
| Limits | Hand limit 7; 24 cubes per color; 6 research stations; 5 cards to cure |
| Losses | The 8th outbreak; too few cubes to place; fewer than 2 player cards to draw |
| Win | The 4th cure, at once (eradication is not needed) |

## How the rules are played online

Decided with the user (Pandemic 01):

- **Turn order** is random: `createGame` shuffles the seats once, and the order holds for the whole game (no "highest population goes first"; cities have no population).
- **Hands are open** to everyone at every difficulty.
- **One move per card**: after the actions, the active player makes `draw` (both cards at once), then one `epidemic` move per epidemic step (Increase, Infect, Intensify) and one `infect` move per infection card. Events (Pandemic 05) fit wherever the rulebook allows them: between infection cards, between two epidemics, between an epidemic's Infect and Intensify.
- **No undo** of any action.
- **Share Knowledge** is an offer (`share-offer`, give or take, always from the active player) that the partner answers (`share-accept` / `share-decline`) or the active player takes back (`share-cancel`). The action is spent only when accepted, and while an offer is open the active player can do nothing else. Moving another player's pawn (Dispatcher, Airlift) will work the same way.
- **The hand limit** is a pending `discard` that blocks play until done, even for a player outside their turn (the receiver of a shared card). After a draw it is checked once the epidemics are resolved.
- **Chain reactions** resolve first in, first out, neighbors in the city list's order; a city outbreaks once per infection card. The rulebook gives no order; it only matters when the cubes run out.
- **An empty infection deck** (not expected: epidemics refill it) flips no card, and the discard pile stays.

## State

`GameState` holds the turn order (`seats`), the `epidemics` count, the `turn` (`seat`, `actionsLeft`, `step`: `actions` → `draw` → `epidemic` → `infect`; the epidemics left to resolve, the next `epidemicStep`, the `infectionsLeft`), `pending` (an open share offer or an owed discard), `status` and `lossReason`, `pawns`, `hands`, `cubes` (every city, per color), `supply`, `stations`, both decks (top card first) and discard piles, `outbreaks`, `infectionRate` (the marker's position), `cures` (`none` / `cured` / `eradicated`), `rngSeed` and `rngState`.

Every check returns `{ ok: true }` or `{ ok: false, reason }` with a code: `game-over`, `not-your-turn`, `wrong-step`, `answer-first`, `no-actions-left`, `same-city`, `not-adjacent`, `card-missing`, `no-station`, `station-exists`, `bad-station-to-move`, `no-cubes`, `already-cured`, `bad-cards`, `bad-partner`, `not-together`, `no-offer`, `not-your-answer`, `nothing-to-discard`. The `apply` functions throw on an illegal move.

## Engine adapter

`pandemic` (`definition.ts`): `meta` seats `p1`–`p4`, 2–4 players, `coop`; `configSchema` `{ players, epidemics }` (`setup` plays the seats actually taken); `actors` gives the active seat as `turn`, a seat owing a discard or answering a share offer as `prompt`; `table:join` changes nothing, `table:choose-seat` is refused (the order is random); no system moves and no `schedule`.

**Views** show the whole table: every hand, both discard piles, the cubes, the tracks. Each deck is only a size (`playerDeckSize`, `infectionDeckSize`), so no view holds a deck order, where the epidemics are, or the seed. Fields are copied by name: a new state field stays private until `viewFor` adds it.
