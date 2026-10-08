# Pandemic 09: On the Brink: roles and events

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **medium-high**

Needs [Pandemic 08](phase-08-expansion-modules.md). Expansion phases are optional and start only when the user wants them. The rulebooks are the spec: check every card, number and rule against them before coding, and list what is unclear under Open questions as "Assumption (to confirm)"; never present unverified data as official.

## Goals

- The new role and event cards of On the Brink, playable from the board.

## Feature scope

- **In:** the expansion's new roles and event cards as a module; the role list in the lobby (random deal and choice) and the event cards added to the player deck; each card with its tests and its UI control.
- **Out:** the challenges (10) and the fifth disease's rules (10).

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with its tests passing.

- [ ] 1. **L** Read the rulebook and write the full list of new roles and events into this file's Open questions with their exact text; confirm it with the user.
- [ ] 2. **M** Role hooks for the new roles that change movement or treating (one sitting per two roles; add one task per extra pair).
- [ ] 3. **M** Role hooks that change cards, curing or the infect step.
- [ ] 4. **M** New events as `play-event` kinds (one sitting per two or three events), with the allowed moments.
- [ ] 5. **L** Module setup: the cards join the pools and the deck size and epidemic piles stay correct; tests.
- [ ] 6. **M** Client: role cards, role controls and event buttons for the new cards; texts in English.
- [ ] 7. **L** Playwright: a game with the module on, one new role and one new event played.

## Checklist

- [ ] Every new role and event matches the rulebook and is tested
- [ ] Base game unchanged with the module off

## Open questions

- The exact card list and wording, from the rulebook (to fill in at task 1).

**Done when:** a game with the module on deals the new cards and every one works from the board.
