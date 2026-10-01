# Phase 9: Persistence

[← Master plan](../PLAN.md) · Milestone M4 · **Status: ⏳ Not started** · Effort: **medium-low** (1–2 sessions)

## Goals

- Games survive a server restart or redeploy: players reload and land back in their seats.
- A storage layer that later phases (history, accounts) can build on.

## Feature scope

- **In:** saving rooms (players, rejoin tokens, `GameState`), loading them at startup, deleting swept rooms, format versioning.
- **Out:** several server instances (would need Redis + the Socket.IO adapter + sticky sessions); accounts.

**Decision to make first:** SQLite (recommended: one file, no extra service, Node 24's `node:sqlite` or `better-sqlite3`) needs a persistent disk — Railway and Fly.io volumes work, **Render's free tier has none**. Redis works on any host but is a separate service. Pick together with the host in [Phase 12](phase-12-deploy.md).

## Technical tasks

1. `RoomStore` interface in the server: `loadAll()`, `save(room)`, `delete(code)`; an in-memory version for tests and dev.
2. SQLite (or Redis) implementation: one table `rooms(code, json, version, updated_at)`.
3. Write-through: save after every accepted change (create, join, leave, successful move, ability, reroll, rematch), off the reply path. Socket ids are not saved.
4. Startup: load all rooms with every player offline; re-arm round timers with `syncRoundTimer` (a deadline that passed while down expires at once); rebuild per-IP counts.
5. Sweep deletes from the store too.
6. Versioning: store a format version; rooms from an incompatible version are dropped instead of loaded wrongly.
7. Config: `DATA_DIR` (or `REDIS_URL`); docs in [sharing and deployment](../reference/sharing-and-deployment.md).

## Checklist

- [ ] Storage choice made together with the host
- [ ] `RoomStore` interface + in-memory implementation
- [ ] SQLite (or Redis) implementation
- [ ] Write-through after every accepted change
- [ ] Load on startup; timers re-armed; per-IP counts rebuilt
- [ ] Sweep deletes stored rooms
- [ ] Format version check; incompatible rooms dropped
- [ ] Tests: store unit tests; restart integration test (play, restart on the same store, rejoin, identical view); timer across a restart
- [ ] Docs and `CLAUDE.md` updated (the "game state is in memory" rule)

**Done when:** a game in progress continues with the same view after the server process is restarted, in an automated test and by hand.
