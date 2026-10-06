# Platform 03: Generic protocol

[← Platform epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ✅ Done (Oct 6, 2026)** · Effort: **medium**

Design reference: [multi-game proposal](../../proposals/multi-game-platform.md), sections 4.2 and 4.3 (step C).

## Goals

- One wire protocol for every game: `room:*` for the platform, `match:move` / `match:view` for games.
- The server's handlers contain no game rules and no per-action events.

## Feature scope

- **In:** a `packages/protocol` (envelope types + Zod); `room:create { game, config }`; `match:move { matchId, seq, move }` validated by the game's `moveSchema`; `match:view { matchId, version, view }`; a match runner with one serialized queue per match; a game registry.
- **Out:** several server instances (Platform 07); storage (Platform 04).

## Technical tasks

1. `packages/protocol`: envelopes, error codes (platform codes + the game's own rejection codes), typed with generics.
2. Match runner: queue per match → `validate` → `apply` → `view` per seat → broadcast; duplicate `seq` is a no-op (keeps the "repeated requests are harmless" rule).
3. Game registry: `Map<gameId, GameDefinition>`; `room:create` checks the config with the game's `configSchema`.
4. Client and server switch to the new events in one release; remove the `game:*` events.
5. View `version`: the client drops stale views and asks for a resync on a gap.

## What was built

- **`packages/protocol`** (`@platform/protocol`): the Zod schemas of every incoming payload (`createRoomSchema`, `joinRoomSchema`, `rejoinRoomSchema`, `emptySchema`, `chooseSeatSchema`, `rematchSchema`, `moveSchema`), `PlatformError`, `JoinResult` (now with `matchId` and `seq`), `AckResult<Reason>`, `SeatInfo`, `Presence<Seat>`, `MatchView<View>`, and the event maps `ClientEvents<Seat, Move, Config, Reason>` / `ServerEvents<Seat, View>`. The server's `schemas.ts` is gone (its test moved here).
- **Events**: `room:create { name, game, config }`, `room:join`, `room:rejoin`, `room:leave`, `room:choose-seat`, `room:rematch { matchId, config }`, `match:move { matchId, seq, move }`; server to client `room:presence` and `match:view { matchId, version, view }`. Every `game:*` event is removed.
- **Engine**: `started(state)` (optional): before it, a rematch only changes the setup; Sky Team: `phase !== 'setup'`.
- **Sky Team** (`packages/shared`): `events.ts` is now aliases of the generic types (`SKY_TEAM`, `PlayerMove`, `GameSetup` = the lobby's `{ scenario?, timer? }`); the config is `{ scenario, timer, roundTimerMs, autoRollDelayMs }` with `skyTeamLobbySchema` for what a client may choose.
- **Server**: the registry (`games.ts`: `createRegistry(settings)`, `configFor`); `RoomManager` gets `settings` per game (replacing the handler options `roundTimerMs` / `autoRollDelayMs`), names each room's game (`gameId`), keeps the current match (`match: { id, number, version }`) and each player's last `seq`; `play` (the `seq` check, then `move`), `requestRematch`, `replaceGame` (the E2E route). `handlers.ts` imports no game code. Saved rooms: `ROOM_FORMAT` 3 (game id, match, players' `seq`).
- **Client**: `api.ts` sends every game action as `match:move` with the match id and a counter that only goes up (seeded from the join / rejoin ack), drops a view older than the one it has, and sends `room:rematch { matchId, config }`; the error texts `unknown-game` and `stale-match` in English, Vietnamese and French.
- **Deploy**: `ROOM_FORMAT` 3 drops the rooms saved by the live site on the next deploy, so a game in progress then ends.
- **Tests**: the server tests use `move` / `moveWithSeq` / `rematch` / `nextView` from `test-server.ts`; new tests for versions moving forward, a move for another match (`stale-match`), an unknown game, a bad config and an unknown move; the double-tap test is now a resend with the same `seq`.

## Open questions

None open.

## Checklist

- [x] `packages/protocol` with Zod envelopes
- [x] Match runner with per-match queue, `seq` idempotency, versions (the queue is the event loop: see Open questions)
- [x] Game registry; config checked per game
- [x] Client and server on `match:move` / `match:view`; old events removed
- [x] Integration tests (socket.io-client) and Playwright green
- [x] Protocol doc and `CLAUDE.md` updated

**Done when:** a full Sky Team game plays over `match:move` / `match:view` only, with the view-leak checks passing on every broadcast. ✅ Verified Oct 6, 2026 (the integration test that plays a whole seeded game over sockets, now on `match:move` / `match:view`, ends exactly like the in-process game and checks every view each client received for the partner's dice; no `game:*` event is left in the code; `handlers.ts` and `rooms.ts` import only the engine, the protocol and the registry; 413 unit and integration tests and 41 Playwright tests on three devices pass, 4 intentional skips; typecheck, lint, format and build pass).
