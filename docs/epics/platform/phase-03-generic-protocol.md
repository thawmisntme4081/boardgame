# Platform 03: Generic protocol

[← Platform epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **medium**

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

## Checklist

- [ ] `packages/protocol` with Zod envelopes
- [ ] Match runner with per-match queue, `seq` idempotency, versions
- [ ] Game registry; config checked per game
- [ ] Client and server on `match:move` / `match:view`; old events removed
- [ ] Integration tests (socket.io-client) and Playwright green
- [ ] Protocol doc and `CLAUDE.md` updated

**Done when:** a full Sky Team game plays over `match:move` / `match:view` only, with the view-leak checks passing on every broadcast.
