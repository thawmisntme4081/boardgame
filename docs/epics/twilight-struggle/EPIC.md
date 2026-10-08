# Epic: Twilight Struggle

[← Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **high**

## Goal

Twilight Struggle on the platform: a 2-player Cold War game (USA and USSR) of card play, influence on a world map and scoring regions, played over 2–3 hours.

**What it adds to the platform:** hidden hands and a shuffled deck; many questions to the opponent in the middle of a turn (`prompt` actors: events, headlines, discards); long games that must save and resume (and maybe asynchronous play over several days, with notifications from an outside cron, since the Fly machine stops when idle).

**Licensing:** a published, trademarked game. Fine for the private, invite-only site; a public site needs the publisher's permission or an original game.

**Epic done when:** two players finish a full game on desktop and phone, saving and resuming across sessions, with all its rules tested.

## Phases (planned, from the [game epic template](../../PLAN.md#game-epic-template))

| # | Phase | Status |
| --- | --- | --- |
| 01 | Rules core (`GameDefinition`, turns, actions, influence, coups, scoring; tests and random play) | ⏳ Not started |
| 02 | Platform changes and walking skeleton (prompts to the opponent, long games across restarts; a plain client, a basic game finishes) | ⏳ Not started |
| 03 | Board and client (world map, hands, prompts; desktop first, then phone) | ⏳ Not started |
| 04 | Card events (rules and UI, a few cards per task, each with its tests) | ⏳ Not started |
| 05 | Long games (resume, optional turn notifications) | ⏳ Not started |
| 06 | Setup, variants and history (options, Flight Log) | ⏳ Not started |
| 07 | Translations (EN, VI, FR) | ⏳ Not started |

Phase files (tasks as a checklist, each low or medium effort) are written when the epic starts. The rulebook is the spec; unclear rules go into the phase file's Open questions, marked "Assumption (to confirm)".

## Order and dependencies

- Needs the [Platform epic](../platform/EPIC.md) and the [Pandemic epic](../pandemic/EPIC.md).

## Requirements noted early

- **Long games and the platform's timings:** a room nobody is connected to is swept after `ROOM_TTL_MINUTES` (30 minutes) and its match marked abandoned; Sky Team is played in one sitting, Twilight Struggle over days. Before this epic, make the idle time a per-game setting in the registry (`games.ts`, next to `abandonedTtlMs`), and leave `abandonedTtlMs` unset (or long) for Twilight Struggle so a paused game is never deleted.
