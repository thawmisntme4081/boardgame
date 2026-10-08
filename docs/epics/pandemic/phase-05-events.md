# Pandemic 05: Event cards

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **medium-high**

Needs [Pandemic 04](phase-04-roles.md). Rules and UI together; the first real test of out-of-turn moves on the platform.

## Goals

- The five event cards, playable from any player's hand at any allowed moment, including outside their turn.

## Feature scope

- **In:** Airlift (move any pawn anywhere), Forecast (see the top 6 infection cards, put them back in any order), Government Grant (a station anywhere), One Quiet Night (skip the next infect step), Resilient Population (remove a card from the infection discard pile, also during an epidemic's pause); the moments events are refused (while a card is being resolved); playing an event instead of discarding over the hand limit; the Contingency Planner's stored event.

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with its tests passing.

**Rules**

- [ ] 1. **M** `play-event` from any seat holding the card; `canPlayEvent(state, seat)` for the allowed moments; how optional out-of-turn moves fit `actors` (allowed by `validate`, no one has to make them) written in the proposal, and the contract changed if needed.
- [ ] 2. **M** Airlift, Government Grant and One Quiet Night; Airlift on someone else's pawn is an offer its owner accepts or declines (the player can cancel), like Share Knowledge.
- [ ] 3. **M** Resilient Population, including the epidemic's pause.
- [ ] 4. **M** Forecast as two steps: the 6 cards appear only in that player's view, then the new order; nothing else may happen in between.
- [ ] 5. **L** Events and the hand limit; the Contingency Planner playing the stored event (then out of the game).

**Client**

- [ ] 6. **M** A "Play" button on event cards in any hand when allowed; Airlift and Grant targets chosen on the map; a toast for the other players.
- [ ] 7. **M** Forecast dialog: drag (or up/down buttons on phones) to reorder 6 cards.
- [ ] 8. **L** Playwright: a player plays an event during someone else's turn.

## Checklist

- [ ] All five events tested, out of turn included, and refused at the forbidden moments
- [ ] Contract note in the proposal
- [ ] Event controls on the board, tested

## Open questions

- Two players play an event at the same moment: the first move the server receives wins (assumed).

**Done when:** every event plays from any seat at the allowed moments and is refused at the others, from the board and in tests.
