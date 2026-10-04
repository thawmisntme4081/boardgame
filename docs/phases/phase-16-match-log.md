# Phase 16: Match log (persistence for every game)

[← Master plan](../PLAN.md) · Milestone M6 · **Status: ⏳ Not started** · Effort: **medium**

Design reference: [multi-game proposal](../proposals/multi-game-platform.md), section 4.4 (step D).

## Goals

- Every match, of any game, survives restarts and deploys, stored as config + seed + move log, with snapshots.
- Replay and history (Phase 18) read the same data.

## Feature scope

- **In:** a `MatchStore` interface replacing [Phase 11](phase-11-persistence.md)'s `RoomStore`; tables `matches`, `match_seats`, `match_moves`, `match_snapshots`; load = snapshot + replay; `rules_version` and `migrate`; a one-off migration of Phase 11's stored rooms.
- **Out:** several instances (Phase 20).

**Decision to make first:** Postgres (recommended with several games, accounts and history) or SQLite on a single instance. The interface keeps the choice reversible.

## Technical tasks

1. `MatchStore`: `create`, `appendMove`, `saveSnapshot`, `load`, `listOpen`, `end`; in-memory version for tests.
2. Database implementation with migrations (Drizzle or Kysely).
3. Append each accepted move inside the match queue, before the broadcast; snapshot every ~50 moves and at game end.
4. Startup: load open matches, rebuild views, re-arm the scheduler from `schedule(state)`.
5. Rules versions: each match stores `rules_version`; old matches load through `migrate` or are finished on old rules.
6. Migrate rooms stored by Phase 11.

## Checklist

- [ ] Storage decision (Postgres or SQLite) together with the host
- [ ] `MatchStore` + in-memory and database versions
- [ ] Moves appended before broadcast; snapshots
- [ ] Load on startup; timers re-armed
- [ ] `rules_version` + `migrate`
- [ ] Phase 11 rooms migrated
- [ ] Tests: replay equals live state for random games; restart integration test
- [ ] Deployment doc and `CLAUDE.md` updated

**Done when:** a match in progress continues with identical views after a restart, and replaying any stored match from its log reproduces its final state exactly.
