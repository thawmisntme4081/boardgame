# Pandemic 05: Event cards

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: 🚧 In progress** · Effort: **medium-high**

Needs [Pandemic 04](phase-04-roles.md). Rules and UI together; the first real test of out-of-turn moves on the platform.

## Goals

- The five event cards, playable from any player's hand at any allowed moment, including outside their turn.

## Feature scope

- **In:** Airlift (move any pawn anywhere), Forecast (see the top 6 infection cards, put them back in any order), Government Grant (a station anywhere), One Quiet Night (skip the next infect step), Resilient Population (remove a card from the infection discard pile, also during an epidemic's pause); the moments events are refused (while a card is being resolved); playing an event instead of discarding over the hand limit; the Contingency Planner's stored event.

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with typecheck, lint and format passing; tests are written and run at the end of the phase, after your review.

**Rules**

- [x] 1. **M** `play-event` from any seat holding the card; `canPlayEvent(state, seat)` for the allowed moments; how optional out-of-turn moves fit `actors` (allowed by `validate`, no one has to make them) written in the proposal, and the contract changed if needed.
- [x] 2. **M** Airlift, Government Grant and One Quiet Night; Airlift on someone else's pawn is an offer its owner accepts or declines (the player can cancel), like Share Knowledge.
- [x] 3. **M** Resilient Population, including the epidemic's pause.
- [x] 4. **M** Forecast as two steps: the 6 cards appear only in that player's view, then the new order; nothing else may happen in between.
- [x] 5. **L** Events and the hand limit; the Contingency Planner playing the stored event (then out of the game).

**Client**

- [x] 6. **M** A "Play" button on event cards in any hand when allowed; Airlift and Grant targets chosen on the map; a toast for the other players.
- [x] 7. **M** Forecast dialog: drag to reorder 6 cards.
- [x] 8. **L** Playwright: a player plays an event during someone else's turn.

**Checks**

- [ ] 9. **M** Write the phase's tests (rules, client; including a per-viewer leak check: no view but the forecaster's holds the Forecast cards, spectators included; and the random player playing events in the engine kit) and run the full suite: `pnpm test`, `pnpm e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (after your review of tasks 1–8).

## Checklist

- [ ] All five events tested, out of turn included, and refused at the forbidden moments
- [ ] Contract note in the proposal
- [ ] Event controls on the board, tested

## Decisions

Settled with the user before task 1:

- **When:** no event from drawing an epidemic until it is resolved, except Resilient Population between its Infect and Intensify steps; two epidemics drawn together allow events again once the first is resolved (`Turn.epidemicsResolved`).
- **One Quiet Night** skips the next infect step that has not started: played during an infect step, it is the next turn's.
- **While something is pending:** an open Share Knowledge or pawn-move offer, or a Forecast being arranged, refuses every event (`answer-first`); a player owing a hand-limit discard may play an event instead (the others wait).
- **Airlift on another pawn:** the card stays in hand until the owner accepts; a decline or cancel changes nothing.
- **Government Grant** with all 6 stations built moves one from elsewhere, like Build.
- **Log:** every event played goes into the turn log (in the actions too), and the other players get a toast; cards removed from the game show only in the log.
- **Forecast dialog:** native drag plus up/down buttons, no new library; fewer than 6 cards left shows them all.
- Two players play an event at the same moment: the first move the server receives wins.

## Open questions

- None so far.

**Done when:** every event plays from any seat at the allowed moments and is refused at the others, from the board and in tests.
