# Phase 2: Server and rooms

[← Master plan](../PLAN.md) · Milestone M1 · **Status: ✅ Done (Sep 28, 2026)**

## Goals

- A server that hosts rooms for two players and sends each a filtered view.
- Every incoming payload validated; no handler can crash the process.

## Feature scope

- **In:** Express `/health`, Socket.IO, room codes and seats, reconnect tokens, `room:create/join/rejoin`, `game:ready`, Zod schemas, `viewFor`, typed protocol.
- **Out:** placing dice over the wire (Phase 3), UI.

## Technical tasks

1. `app.ts` builds the Express + Socket.IO server unstarted (tests pick a random port).
2. Room manager: 4-letter codes (no I or O), creator = pilot, joiner = co-pilot, UUID reconnect tokens.
3. Handlers for `room:create`, `room:join`, `room:rejoin`, `game:ready` (roll when both are ready).
4. Zod schemas for every payload; bad payloads, missing acks and handler errors answer `bad-request`.
5. `viewFor` in `shared/views.ts`; typed protocol in `shared/events.ts`.

## Checklist

- [x] Express serves `/health`; Socket.IO attached to the same HTTP server (`app.ts` builds it unstarted so tests pick a random port)
- [x] Room manager: 4-letter codes (no I or O), creator = pilot, joiner = co-pilot, UUID reconnect tokens
- [x] Handlers for `room:create`, `room:join`, `game:ready` (dice roll when both players are ready), plus server-side `room:rejoin`
- [x] Zod schemas for every incoming payload; bad payloads, missing acks and handler errors answer `bad-request` without crashing
- [x] `viewFor` in `shared/views.ts` and the typed protocol in `shared/events.ts` (needed for `game:view`)

**Done when:** two socket clients in an integration test can join the same room and both receive a `game:view`. ✅ Verified Sep 28, 2026: 99 tests pass (30 new: rooms, schemas, `viewFor`, and Socket.IO integration tests against a real server).

See [protocol reference](../reference/protocol.md).
