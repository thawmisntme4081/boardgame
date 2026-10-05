# Sky Team 12: Persistence

[← Sky Team epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **medium-low** (1–2 sessions)

## Goals

- Games survive a server restart or redeploy: players reload and land back in their seats.
- A storage layer that later phases (history, accounts) can build on.

**Looking ahead:** [Platform 04](../platform/phase-04-match-log.md) turns this store into the platform's move log + snapshots. Keep storage behind the `RoomStore` interface, and keep the room's game state and its accepted-move log (`GameState.log`) in separate fields, so that rework stays small. Use a query library that supports both SQLite and Postgres (Drizzle), so a later move to Postgres ([Platform 07](../platform/phase-07-scale-out.md)) is a data copy, not a rewrite.

## Feature scope

- **In:** saving rooms (players, rejoin tokens, `GameState`), loading them at startup, deleting swept rooms, format versioning.
- **Out:** several server instances ([Platform 07](../platform/phase-07-scale-out.md)); accounts.

**Storage decided (Oct 4, 2026): SQLite** in a file on a Fly.io volume (Node 24's `node:sqlite` or `better-sqlite3`, through Drizzle), backed up continuously with Litestream. Host: a private site on **one Fly.io machine with auto stop/start**, behind Cloudflare Access (about $1.50–2.50/month plus the domain). See [sharing and deployment](../../reference/sharing-and-deployment.md#chosen-hosting-private-site-on-flyio).

**Auto stop/start:** the machine stops when nobody is connected and starts on the next visit, so nothing runs while it is stopped. Never rely on an in-process timer firing while players are away: deadlines are stored and checked whenever the room is loaded or touched (a deadline that passed while stopped expires at once), and idle rooms are swept on startup as well as on the interval.

## Technical tasks

1. `RoomStore` interface in the server: `loadAll()`, `save(room)`, `delete(code)`; an in-memory version for tests and dev.
2. SQLite implementation through Drizzle: one table `rooms(code, json, version, updated_at)`; WAL mode.
3. Write-through: save after every accepted change (create, join, leave, successful move, ability, reroll, rematch), off the reply path. Socket ids are not saved.
4. Startup: load all rooms with every player offline; re-arm round timers with `syncRoundTimer` (a deadline that passed while down expires at once); rebuild per-IP counts; sweep rooms idle longer than `ROOM_TTL_MINUTES` (the machine may have been stopped for days).
5. Sweep deletes from the store too.
6. Versioning: store a format version; rooms from an incompatible version are dropped instead of loaded wrongly.
7. Config: `DATA_DIR` (the volume mount, e.g. `/data`); docs in [sharing and deployment](../../reference/sharing-and-deployment.md).
8. Backups: Litestream replicating the SQLite file to object storage (Cloudflare R2 free tier, or Fly Tigris); a documented restore.

## Checklist

- [x] Storage choice made together with the host (SQLite on a Fly volume, Oct 4, 2026)
- [ ] `RoomStore` interface + in-memory implementation
- [ ] SQLite implementation (Drizzle, WAL)
- [ ] Write-through after every accepted change
- [ ] Load on startup; timers re-armed; per-IP counts rebuilt; idle rooms swept
- [ ] Sweep deletes stored rooms
- [ ] Litestream backup and a tested restore
- [ ] Format version check; incompatible rooms dropped
- [ ] Tests: store unit tests; restart integration test (play, restart on the same store, rejoin, identical view); timer across a restart
- [ ] Docs and `CLAUDE.md` updated (the "game state is in memory" rule)

**Done when:** a game in progress continues with the same view after the server process is restarted, in an automated test and by hand.
