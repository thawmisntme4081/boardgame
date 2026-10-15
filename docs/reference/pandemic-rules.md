# Pandemic: game state and rules

[← Master plan](../PLAN.md) · [Pandemic epic](../epics/pandemic/EPIC.md) · Sky Team's rules: [game-rules.md](game-rules.md)

The spec is the rulebook in `docs/rulebooks/pandemic_rules.pdf` (Z-Man, 2013 edition, © 2015 printing; kept out of git). As for Sky Team, the whole game is one plain-JSON `GameState` plus pure functions that return a new state; no rule lives in React or in socket handlers. Roles (Pandemic 04, `roles/`) and event cards (Pandemic 05, `events/`) are modules the core rules call through hooks and never test by name.

## Files (`games/pandemic/rules/src`)

| File | Contents |
| --- | --- |
| `cities.ts` | The 48 cities: `color`, `links` (the white lines, Pacific ones included, in a fixed order; where each city sits on the map picture is the client's `lib/mapGeometry.ts`); `cityOf`, `areLinked`, `PACIFIC_LINKS`. Written from the standard board (the rulebook's text has none of it); to be checked against the physical board |
| `types.ts` | `SeatId` (`p1`–`p4`), the rulebook's numbers, `EVENT_IDS`, `ROLE_IDS`, `PlayerCard` / `HandCard`, `Turn`, `Pending`, `GameState`; `ActionState` (the fields the move checks read: a state or a view) |
| `setup.ts` | `createGame({ seats, epidemics, seed, ordered?, roles? })`, the seeded `shuffle`, `pileSizes` |
| `preflight.ts` | The "before the game" step: `beginSetup`, `checkPreflight` / `applyPreflight` (`pick-role`, `confirm`, `unconfirm`); the last confirm deals the board |
| `actions.ts` | The actions: `checkAction` (a reason code), `applyAction`, `spendAction`, `cubesOnBoard`, `cardsToCure` |
| `playEvent.ts` | Event cards: `eventMoment` (when events may be played), `canPlayCard` / `canPlayEvent` (the client's check too), `heldEvents`, `checkPlayEvent` / `applyPlayEvent`, `resolveEvent` (also run when an Airlift offer is accepted) |
| `events/` | One `EventModule` per card (`airlift`, `forecast`, `governmentGrant`, `oneQuietNight`, `resilientPopulation`), their `EventPlay` choices and the `PlayEventMove` type; Forecast's second step (`forecast-order`) |
| `share.ts` | Share Knowledge as an offer and an answer: `checkShare`, `applyShare`, `shareAnswerer` |
| `outbreak.ts` | `infectCity` (infections, epidemics, outbreaks and chain reactions; returns the cubes placed and the cities that outbroke), `lose` |
| `log.ts` | `GameLog`: the current and the previous turn, each a list of `LogEntry` (`draw`, `epidemic-increase`, `epidemic-intensify`, `infect` with its cubes and outbreak chain); `emptyLog`, `nextTurnLog`; the board does not show it any more (its "Turn log" section was removed) |
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
- **No undo** of a single action; instead the active player can **restart the turn** (below).
- **Share Knowledge** is an offer (`share-offer`, give or take, always from the active player) that the partner answers (`share-accept` / `share-decline`) or the active player takes back (`share-cancel`). The action is spent only when accepted, and while an offer is open the active player can do nothing else. Moving another player's pawn (Dispatcher, Airlift) will work the same way.
- **The hand limit** is a pending `discard` that blocks play until done, even for a player outside their turn (the receiver of a shared card). After a draw it is checked once the epidemics are resolved.
- **Chain reactions** resolve first in, first out, neighbors in the city list's order; a city outbreaks once per infection card. The rulebook gives no order; it only matters when the cubes run out.
- **An empty infection deck** (not expected: epidemics refill it) flips no card, and the discard pile stays.

## Before the game (Pandemic 06)

Decided with the user:

- **The lobby chooses** the players (2 to 4), the difficulty (`epidemics` 4, 5 or 6: introductory, standard, heroic) and the **role mode** (`roleMode`: `random`, the default, or `choose`).
- **A step before the deal** (`status: 'setup'`, `SetupState`, `preflight.ts`): when the last seat is taken the turn order is drawn (from the seed, whoever sat down first) and, in random mode, the roles are dealt; in choose mode each player picks a role nobody else has (`pick-role`, changeable until confirming). Everyone presses `confirm` (a confirm can be taken back with `unconfirm` until the last one); the last confirm deals the board (`createGame` with that order and those roles). The step is public (`SetupView`: order, roles, who is ready; no seed, no decks) and counts as part of the match (`started`), with every unconfirmed seat an actor (`simultaneous`).
- **A rematch** keeps the players still seated (2 or more), the difficulty and the role mode, draws a new turn order, and starts the step again: random roles are dealt again, and in choose mode everyone picks again from scratch.
- **The deal is played back by the client** (`lib/deal.ts`): the server deals at once; when a view turns from the step to the dealt board in this session, the board shows a display view that fills on a timeline of about 10 s (the station and the pawns, each starting infection card then its cubes, the hands card by card in turn order, then the player deck built in its epidemic piles) with the actions off, and not for a page opened later or with reduced motion.
- No Flight Log for Pandemic.

## Event cards (Pandemic 05)

Decided with the user (Pandemic 05):

- **Any seat, any card, almost any moment.** `play-event` is a move of any seat, on its turn or not, and not an action. The card can be any player's, in a hand or on the Contingency Planner's role card (hands are open): `owner` names whose (default: the player's own); it leaves the owner, and the player who plays it makes the choices. Decided with the user after Pandemic 06. `validate` allows it; `actors` does not list it (nobody has to), so the platform needed no change. Two players at the same moment: the first move the server receives wins.
- **When.** Refused after the game is over, and while something is pending (an open Share Knowledge or pawn-move offer, a Forecast being arranged: `answer-first`), except that the player owing a hand-limit discard may play an event instead of discarding. Refused from drawing an epidemic until it is resolved (`card-resolving`); Resilient Population alone may be played in the pause between an epidemic's Infect and Intensify steps; two epidemics drawn together allow events again once the first is resolved (`Turn.epidemicsResolved`).
- **Airlift** on your own pawn moves it at once. On another player's pawn it is a move offer like the Dispatcher's (`pending.move` holds the `play-event` move): the card stays in hand until the owner accepts; declining or canceling changes nothing. No action is spent.
- **Government Grant** builds a station with no card; once all 6 stand, `move` names the one taken away (the Build rules: `checkStationPlace`).
- **One Quiet Night** sets `quietNight`; the next infect step that starts is skipped (the turn ends, the log says so). Played during an infect step, it skips the next turn's; epidemics still infect.
- **Resilient Population** takes a card of the infection discard pile out of the game.
- **Forecast** is two moves. Playing it takes the top 6 infection cards (all that are left) into `pending: { kind: 'forecast', seat, count, cards }`; nothing else can happen until that player sends `forecast-order` with the same cards in the new order (top first). Only that seat's view holds `cards`; every other view, spectators included, gets `cards: []` and the `count`. The log records that it was played, never the order. Forecast cannot be played while a hand-limit discard is owed.
- **The hand limit.** An event played from the hand counts as a discard (the owed discard ends once the hand is back to 7). The card on the Contingency Planner's role card is outside the hand: playing it removes it from the game (not onto the discard pile) and does not relieve a discard.
- **The log** has an `event` entry for every card played (who, which, the target city or pawn, `stored` for the role card) and a `quiet-night` entry. The client toasts the others' events.
- New refusal codes: `card-resolving`, `not-playable`, `no-forecast`, `bad-order`. Rules version 4 (`epidemicsResolved`, `quietNight`); older saved games are dropped.

## Restart turn

Decided with the user (after Pandemic 06): until the cards are drawn, the active player can take back everything done this turn, all four actions and the event cards they played, and start the turn again (`restart-turn`, a button next to Pass).

- The game keeps a **checkpoint** (`GameState.checkpoint`, `restart.ts`): a copy of itself taken just before the first move of the turn (`withCheckpoint`, called by `applyMove`), cleared when the cards are drawn or the turn ends. It is private: `viewFor` sends only `restartable`. A restart puts the checkpoint back and clears it, so the next move takes a new one (a restart with nothing done is refused).
- **Allowed** in the actions step and before the draw (after the last action or Pass), by the active player only (`cannot-restart` otherwise).
- **Refused** while an offer (Share Knowledge, a pawn move) or a Forecast waits for its answer, and once **another player played an event card** during the turn (it was theirs to play and is not taken back). An accepted Share Knowledge or pawn move is taken back with the rest, cards of both players included.
- Assumption (to confirm): a Forecast looked at before a restart stays known to its player, since the deck order is restored as it was.

## State

`GameState` holds the turn order (`seats`), the `epidemics` count, the `turn` (`seat`, `actionsLeft`, `step`: `actions` → `draw` → `epidemic` → `infect`; the epidemics left to resolve, the next `epidemicStep`, the `infectionsLeft`), `pending` (an open share or pawn-move offer, an owed discard, or a Forecast being arranged), `quietNight` (One Quiet Night was played), `contingency` (the Contingency Planner's stored event), `status` and `lossReason`, `pawns`, `hands`, `cubes` (every city, per color), `supply`, `stations`, both decks (top card first) and discard piles, `outbreaks`, `infectionRate` (the marker's position), `cures` (`none` / `cured` / `eradicated`), `rngSeed` and `rngState`.

The `log` keeps what happened after the actions in the current and the previous turn: the cards drawn (epidemics included), each epidemic step (the new infection rate, how many cards went back on the deck), and every city infected (by a card or an epidemic) with the cubes it got and the cities that outbroke in order. Everything in it is public, so views carry it as is. Rules version 2 added it; `migrate` gives a version-1 saved game an empty log.

Every check returns `{ ok: true }` or `{ ok: false, reason }` with a code: `game-over`, `not-your-turn`, `wrong-step`, `answer-first`, `no-actions-left`, `same-city`, `not-adjacent`, `card-missing`, `no-station`, `station-exists`, `bad-station-to-move`, `no-cubes`, `already-cured`, `bad-cards`, `bad-partner`, `not-together`, `no-offer`, `not-your-answer`, `nothing-to-discard`, and for events `card-resolving`, `not-playable`, `no-forecast`, `bad-order`. The `apply` functions throw on an illegal move.

## Engine adapter

`pandemic` (`definition.ts`): `meta` seats `p1`–`p4`, 2–4 players, `coop`; `configSchema` `{ players, epidemics, roleMode }` (`setup` plays the seats actually taken); `actors` gives the active seat as `turn`, a seat owing a discard, answering a share or move offer or arranging a Forecast as `prompt` (event cards are left out: any seat may play one, `validate` allows it); `table:join` changes nothing, `table:choose-seat` is refused (the order is random); no system moves and no `schedule`.

**Views** show the whole table: every hand, both discard piles, the cubes, the tracks. Each deck is only a size (`playerDeckSize`, `infectionDeckSize`), so no view holds a deck order, where the epidemics are, or the seed. Fields are copied by name: a new state field stays private until `viewFor` adds it.
