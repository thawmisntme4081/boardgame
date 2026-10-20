# Epic: Pandemic

[← Master plan](../../PLAN.md) · **Status: 🚧 In progress (base game done; 08: drawn map and cards; expansions ⏸ on hold)** · Effort: **high overall; every task low or medium**

## Goal

Pandemic on the platform: 2–4 players cooperate to cure four diseases before outbreaks, infections or the player deck run out.

**What it adds to the platform:** up to 4 co-op seats; event cards played outside a player's turn (`prompt` actors); a hidden deck order (infection and player decks); role cards with their own powers.

**Licensing:** a published, trademarked game. Fine for the private, invite-only site; a public site needs the publisher's permission or an original game.

**Epic done when:** 2–4 players finish a base game on desktop, with all its rules tested (phases 01–07). The expansions (09–14) come after, when you want them.

## Phases

**How the phases are cut** (the [game epic template](../../PLAN.md#game-epic-template)): rules core first, then a walking skeleton (the platform for N seats and a plain client, so three players finish a basic game early and platform gaps show up in phase 02), then features as slices with their rules and UI together. A phase may be large; its tasks are each **low or medium** effort (about one sitting).

| # | Phase | Status | Effort | Tasks |
| --- | --- | --- | --- | --- |
| 01 | [Rules core](phase-01-rules-core.md): map, setup, actions, draw and infect, outbreaks, win/lose, `GameDefinition`, engine kit | ✅ Done | High | 17 |
| 02 | [Platform for N seats and a walking skeleton](phase-02-walking-skeleton.md): generic registry, 2–4 seat rooms, N-player rematch, plain client; 3 players finish a basic game | ✅ Done | Medium-high | 10 |
| 03 | [Board and client](phase-03-board-and-client.md): SVG map, hands, actions from the map, prompts, log, game over; desktop only | ✅ Done | High | 12 |
| 04 | [Roles](phase-04-roles.md): 12 roles (the base game's 7, 4 fan-made, the Gen Con 2016 promo Z-Force Team Member), rules and UI | ✅ Done | High | 17 |
| 05 | [Event cards](phase-05-events.md): the 5 events out of turn, rules and UI | ✅ Done | Medium-high | 9 |
| 06 | [Setup and variants](phase-06-setup-and-variants.md): difficulty, role choice, turn order, the deal animated (no Flight Log) | ✅ Done | Medium | 9 |
| 07 | [Translations](phase-07-translations.md): EN, VI, FR | ✅ Done | Medium | 5 |
| 08 | [Drawn map and cards](phase-08-drawn-map-and-cards.md): the world map and every card in SVG, no images | 🚧 In progress | Medium | 7 |
| 09 | [Expansion foundation](phase-09-expansion-modules.md): modules, a variable disease list (optional from here) | ⏸ On hold | Medium-high | 8 |
| 10 | [On the Brink: roles and events](phase-10-on-the-brink-roles-events.md) | ⏸ On hold | Medium-high | 8 |
| 11 | [On the Brink: challenges](phase-11-on-the-brink-challenges.md): Virulent Strain, Mutation, Bio-Terrorist | ⏸ On hold | High | 9 |
| 12 | [In the Lab](phase-12-in-the-lab.md) | ⏸ On hold | Medium-high | 7 |
| 13 | [State of Emergency](phase-13-state-of-emergency.md): Superbug, Hinterlands, emergency events, roles | ⏸ On hold | Medium-high | 8 |
| 14 | [Expansion translations](phase-14-expansion-translations.md) | ⏸ On hold | Low | 4 |

Phases 01–07 make the base game and finish the epic's "done when" check; 09–14 are the expansions, **on hold** for now (the user's decision, 2026-10-20; resume with phase 09 when wanted) (10–13 are independent of each other once 09 is done; expansion phase files list their card lists as Open questions, to fill from the rulebooks at their first task).

The rulebook is the spec; unclear rules go into each phase file's Open questions, marked "Assumption (to confirm)".

## Order and dependencies

- Needs the [Platform epic](../platform/EPIC.md) (done). Layout (from Platform 05): `games/pandemic/rules` (its `GameDefinition`, run by the engine kit) and `games/pandemic/client` (a `GameClientModule`), registered in `packages/server/src/games.ts` and `packages/web/src/games.ts`, plus `games.pandemic` in the platform texts and an `@import` / `@source` in `packages/web/src/index.css`. Sky Team is the example to copy.
- Epic done when also: no Pandemic code in the platform packages.
