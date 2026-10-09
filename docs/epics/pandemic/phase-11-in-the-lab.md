# Pandemic 11: In the Lab

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **medium-high**

Needs [Pandemic 08](phase-08-expansion-modules.md). Expansion phases are optional and start only when the user wants them. The rulebooks are the spec: check every card, number and rule against them before coding, and list what is unclear under Open questions as "Assumption (to confirm)"; never present unverified data as official.

## Goals

- The In the Lab expansion as a module (its lab challenge and new cards).

## Feature scope

- **In:** the lab challenge as a module (the rules in the rulebook), its new roles and cards if any, the lobby choice, the board elements it adds.
- **Out:** other expansions.

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with typecheck, lint and format passing; tests are written and run at the end of the phase, after your review.

- [ ] 1. **L** Read the rulebook; write the lab challenge's rules and card list into Open questions; confirm with the user.
- [ ] 2. **M** Rules module: setup, new state fields and their hooks; tests.
- [ ] 3. **M** The lab's actions and win or lose changes; tests.
- [ ] 4. **M** New roles or events, if the expansion has any (one sitting per two or three cards).
- [ ] 5. **M** Client: the lab's board elements and controls.
- [ ] 6. **L** Playwright: a game with the module on.

## Checklist

- [ ] Rules match the rulebook and are tested
- [ ] Base game unchanged with the module off

## Open questions

- The expansion's exact content (fill in at task 1).

**Done when:** a game with the lab challenge on plays to its end on desktop.
