# Platform 04: Match log (persistence for every game)

[← Platform epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **medium**

Design reference: [multi-game proposal](../../proposals/multi-game-platform.md), section 4.4 (step D).

## Goals

- Every match, of any game, survives restarts and deploys, stored as config + seed + move log, with snapshots.
- Replay and history (Platform 06) read the same data.

## Feature scope

- **In:** a `MatchStore` interface replacing [Sky Team 12](../sky-team/phase-12-persistence.md)'s `RoomStore`; tables `matches`, `match_seats`, `match_moves`, `match_snapshots`; load = snapshot + replay; `rules_version` and `migrate`; a one-off migration of Sky Team 12's stored rooms.
- **Out:** several instances (Platform 07).

**Storage decided (Oct 4, 2026): SQLite** on the Fly volume from [Sky Team 12](../sky-team/phase-12-persistence.md), through Drizzle. Plenty for a private multi-game site; Postgres only if [Platform 07](phase-07-scale-out.md) ever happens, and the interface keeps that move small. With auto stop/start, scheduled moves (`schedule`) are stored with their due time and applied when the match is next loaded or touched if they fell due while the machine was stopped.

## Technical tasks

1. `MatchStore`: `create`, `appendMove`, `saveSnapshot`, `load`, `listOpen`, `end`; in-memory version for tests.
2. SQLite implementation with Drizzle migrations (Litestream keeps backing it up).
3. Append each accepted move inside the match queue, before the broadcast; snapshot every ~50 moves and at game end.
4. Startup: load open matches, rebuild views, re-arm the scheduler from `schedule(state)`.
5. Rules versions: each match stores `rules_version`; old matches load through `migrate` or are finished on old rules.
6. Migrate rooms stored by Sky Team 12.

From Platform 03: rooms already have a match id (`<code>-<n>`), a `version` counting accepted changes and each player's last `seq`; the log can key its rows on the match id and use `version` as the move number. Moves made by `runDue` already come back as `PlayedMove` (`{ move, by, at }`), the row shape the log needs.

## Checklist

- [x] Storage decision: SQLite on the Fly volume (Oct 4, 2026)
- [ ] `MatchStore` + in-memory and database versions
- [ ] Moves appended before broadcast; snapshots
- [ ] Load on startup; timers re-armed
- [ ] `rules_version` + `migrate`
- [ ] Sky Team 12 rooms migrated
- [ ] Tests: replay equals live state for random games; restart integration test
- [ ] Deployment doc and `CLAUDE.md` updated

**Done when:** a match in progress continues with identical views after a restart, and replaying any stored match from its log reproduces its final state exactly.
