# Epic: Pandemic

[← Master plan](../../PLAN.md) · **Status: 🚧 In progress** · Effort: **high overall; every task low or medium**

## Goal

Pandemic on the platform: 2–4 players cooperate to cure four diseases before outbreaks, infections or the player deck run out.

**What it adds to the platform:** up to 4 co-op seats; event cards played outside a player's turn (`prompt` actors); a hidden deck order (infection and player decks); role cards with their own powers.

**Licensing:** a published, trademarked game. Fine for the private, invite-only site; a public site needs the publisher's permission or an original game.

**Epic done when:** 2–4 players finish a base game on phones and desktop, with all its rules tested (phases 01–07). The expansions (08–13) come after, when you want them.

## Phases

**How the phases are cut** (the [game epic template](../../PLAN.md#game-epic-template)): rules core first, then a walking skeleton (the platform for N seats and a plain client, so three players finish a basic game early and platform gaps show up in phase 02), then features as slices with their rules and UI together. A phase may be large; its tasks are each **low or medium** effort (about one sitting).

| # | Phase | Status | Effort | Tasks |
| --- | --- | --- | --- | --- |
| 01 | [Rules core](phase-01-rules-core.md): map, setup, actions, draw and infect, outbreaks, win/lose, `GameDefinition`, engine kit | ✅ Done | High | 17 |
| 02 | [Platform for N seats and a walking skeleton](phase-02-walking-skeleton.md): generic registry, 2–4 seat rooms, N-player rematch, plain client; 3 players finish a basic game | 🚧 In progress | Medium-high | 10 |
| 03 | [Board and client](phase-03-board-and-client.md): SVG map, hands, actions from the map, prompts, log, game over; phone, tablet, desktop | ⏳ Not started | High | 11 |
| 04 | [Roles](phase-04-roles.md): the 7 roles, rules and UI | ⏳ Not started | Medium-high | 11 |
| 05 | [Event cards](phase-05-events.md): the 5 events out of turn, rules and UI | ⏳ Not started | Medium-high | 8 |
| 06 | [Setup, variants and history](phase-06-setup-and-history.md): difficulty, role choice, first player, Flight Log | ⏳ Not started | Medium | 7 |
| 07 | [Translations](phase-07-translations.md): EN, VI, FR | ⏳ Not started | Medium | 4 |
| 08 | [Expansion foundation](phase-08-expansion-modules.md): modules, a variable disease list (optional from here) | ⏳ Not started | Medium-high | 7 |
| 09 | [On the Brink: roles and events](phase-09-on-the-brink-roles-events.md) | ⏳ Not started | Medium-high | 7 |
| 10 | [On the Brink: challenges](phase-10-on-the-brink-challenges.md): Virulent Strain, Mutation, Bio-Terrorist | ⏳ Not started | High | 8 |
| 11 | [In the Lab](phase-11-in-the-lab.md) | ⏳ Not started | Medium-high | 6 |
| 12 | [State of Emergency](phase-12-state-of-emergency.md): Superbug, Hinterlands, emergency events, roles | ⏳ Not started | Medium-high | 7 |
| 13 | [Expansion translations](phase-13-expansion-translations.md) | ⏳ Not started | Low | 3 |

Phases 01–07 make the base game and finish the epic's "done when" check; 08–13 are the expansions, built when you want them (09–12 are independent of each other once 08 is done; expansion phase files list their card lists as Open questions, to fill from the rulebooks at their first task).

The rulebook is the spec; unclear rules go into each phase file's Open questions, marked "Assumption (to confirm)".

## Order and dependencies

- Needs the [Platform epic](../platform/EPIC.md) (done). Layout (from Platform 05): `games/pandemic/rules` (its `GameDefinition`, run by the engine kit) and `games/pandemic/client` (a `GameClientModule`), registered in `packages/server/src/games.ts` and `packages/web/src/games.ts`, plus `games.pandemic` in the platform texts and an `@import` / `@source` in `packages/web/src/index.css`. Sky Team is the example to copy.
- Epic done when also: no Pandemic code in the platform packages.
