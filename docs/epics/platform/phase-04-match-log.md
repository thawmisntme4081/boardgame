# Platform 04: Match log (persistence for every game)

[← Platform epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ✅ Done (Oct 6, 2026)** · Effort: **medium**

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

## What was built

- **Engine**: `replay(definition, state, moves)`, also used by the test kit.
- **`MatchStore`** (`packages/server/src/store.ts`), with `SqliteMatchStore` and `MemoryMatchStore`: `loadRooms` / `saveRoom` / `deleteRoom`, `createMatch` (with the first snapshot), `saveSeats`, `appendMove`, `saveSnapshot`, `endMatch`, `loadMatch` (latest snapshot + the moves after it), `listOpen`. Tables `rooms` (now without the game), `matches`, `match_seats`, `match_moves`, `match_snapshots`; the schema as a list of SQL steps (`MIGRATIONS`, SQLite's `user_version`). Replaces `RoomStore`.
- **Room manager**: `accept` applies every change (player, scheduled and table moves) and logs it before the broadcast; snapshots after setup, every `SNAPSHOT_EVERY` (50) changes, at game end, on shutdown for every open match, and for the E2E route's `replaceGame`. Matches end `over` (with the outcome) or `abandoned` (a leave, a sweep, a new setup before the end). `restoreMatch` rebuilds a match on start (through `migrate` for an older `rules_version`).
- **Ids and tokens**: match ids are `<code>-<number>-<8 hex>` (unique for good; room codes come back), and the room keeps `previousId` for a late "Fly again". Rejoin tokens are stored only as SHA-256 hashes (`tokenHash`); `create` / `join` hand the token back once.
- **Upgrade**: room rows in format 3 (Sky Team 12 to Platform 03, the whole game inside) become a room in format 4 plus a match that starts from the saved game (old tokens hashed), so games in progress on the live site survive this deploy.
- **Size**: about 28 KB per Sky Team match (measured on 20 random games).

## Open questions

- Assumption (to confirm): replay starts from a snapshot of the state right after setup (move 0), not from config + seed: a rematch's setup depends on the previous match (picks carry over), so config and seed alone cannot rebuild it.
- Assumption (to confirm): the room itself stays one JSON row in `rooms` (format 4), not columns; only the match data has its own tables.
- Assumption (to confirm): the schema is migrated by a list of SQL steps in code (`user_version`), not drizzle-kit files: nothing to ship next to the bundle; Drizzle stays for the queries.
- Assumption (to confirm): with a newer rules version, the latest snapshot goes through `migrate` and the later moves are replayed with the new rules. A clean shutdown snapshots every open match, so there are normally no later moves; a game without `migrate` drops the room (old rules cannot run, the code has only the current ones).
- Assumption (to confirm): finished and abandoned matches are kept for good (history, replay); no pruning until the volume needs it.
- Assumption (to confirm): the room row is still saved on the next tick; after a crash right after a move, the move is in the log but a player's `seq` or the room's last activity may be one step behind.

## Checklist

- [x] Storage decision: SQLite on the Fly volume (Oct 4, 2026)
- [x] `MatchStore` + in-memory and database versions
- [x] Moves appended before broadcast; snapshots
- [x] Load on startup; timers re-armed
- [x] `rules_version` + `migrate`
- [x] Sky Team 12 rooms migrated
- [x] Tests: replay equals live state for random games; restart integration test
- [x] Deployment doc and `CLAUDE.md` updated

**Done when:** a match in progress continues with identical views after a restart, and replaying any stored match from its log reproduces its final state exactly. ✅ Verified Oct 6, 2026 (restart tests on a SQLite file: same views for both players after a clean restart, the same game rebuilt from the log alone after an unclean stop, and a timed round that ran out while down; eight random games through the room manager each replay to exactly their live state, from the latest snapshot and from the first one; 422 unit and integration tests and 41 Playwright tests on three devices pass, 4 intentional skips; typecheck, lint, format and build pass).
