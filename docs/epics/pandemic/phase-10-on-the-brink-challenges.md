# Pandemic 10: On the Brink: challenges

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **high**

Needs [Pandemic 09](phase-09-on-the-brink-roles-events.md). Expansion phases are optional and start only when the user wants them. The rulebooks are the spec: check every card, number and rule against them before coding, and list what is unclear under Open questions as "Assumption (to confirm)"; never present unverified data as official.

## Goals

- The three challenges of On the Brink, each a switchable module: Virulent Strain, Mutation, Bio-Terrorist, with the fifth disease where they need it.

## Feature scope

- **In:** Virulent Strain (an epidemic card makes one disease worse), Mutation (the fifth disease and its cubes, cures and events), Bio-Terrorist (a hidden role: a player who works against the team; the only hidden-information role, so views must not leak who it is), the lobby choice of challenges, a game over that names the bio-terrorist.
- **Out:** other expansions.

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with typecheck, lint and format passing; tests are written and run at the end of the phase, after your review.

**Virulent Strain**

- [ ] 1. **M** Rules: the strain cards, their effects on epidemic and infect; tests.
- [ ] 2. **L** Client: strain shown on the tracks and the log; tests.

**Mutation**

- [ ] 3. **M** The fifth disease: mutation cards, purple cubes, the mutation events; cure and eradication through the disease list from 08.
- [ ] 4. **M** Client: the fifth color on the map, hands and tracks.

**Bio-Terrorist**

- [ ] 5. **M** Rules: secret role dealt at setup, its special actions and win condition; `view` never shows it to other seats; tests that no view leaks it.
- [ ] 6. **M** Win and lose rules, including a bio-terrorist win; `outcome` as a coop game that can be lost to the traitor.
- [ ] 7. **M** Client: the traitor's own controls, a hint in the log without revealing them, and the reveal at game over.

**Checks**

- [ ] 8. **M** Each challenge on its own and all together in the engine kit and fast-check runs; Playwright for each challenge.

## Checklist

- [ ] Each challenge matches the rulebook and is tested, alone and combined
- [ ] No view leaks the Bio-Terrorist
- [ ] Base game unchanged with the modules off

## Open questions

- Rule details, from the rulebook (to fill in at the start of each challenge).

**Done when:** the three challenges play separately and together on desktop, with no leak of the hidden role.
