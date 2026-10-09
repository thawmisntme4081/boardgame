# Pandemic 12: State of Emergency

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **medium-high**

Needs [Pandemic 08](phase-08-expansion-modules.md). Expansion phases are optional and start only when the user wants them. The rulebooks are the spec: check every card, number and rule against them before coding, and list what is unclear under Open questions as "Assumption (to confirm)"; never present unverified data as official.

## Goals

- The State of Emergency expansion as modules: Superbug, Hinterlands, emergency events and its new roles.

## Feature scope

- **In:** the Superbug challenge, the Hinterlands challenge, emergency events, the new roles, the lobby choice for each, their board elements.
- **Out:** other expansions.

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with typecheck, lint and format passing; tests are written and run at the end of the phase, after your review.

- [ ] 1. **L** Read the rulebook; write the full content list into Open questions; confirm with the user.
- [ ] 2. **M** Superbug module: rules and tests.
- [ ] 3. **M** Hinterlands module: rules and tests.
- [ ] 4. **M** Emergency events (one sitting per two or three events).
- [ ] 5. **M** New roles (one sitting per two roles).
- [ ] 6. **M** Client: board elements, controls and texts for each module.
- [ ] 7. **L** Playwright with each module on.

## Checklist

- [ ] Each module matches the rulebook and is tested, alone and with the others
- [ ] Base game unchanged with the modules off

## Open questions

- The expansion's exact content (fill in at task 1).

**Done when:** each State of Emergency module plays on desktop, alone and combined with the others.
