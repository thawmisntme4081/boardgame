# Sky Team 06: Robustness

[← Sky Team epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ✅ Done (Sep 29, 2026)**

## Goals

- Games survive reloads, flaky mobile connections, double taps and players leaving.
- The server cleans up after itself and limits abuse.

## Feature scope

- **In:** reconnect tokens, presence, idempotent requests, idle room sweep, per-IP room limit, leaving mid-game.
- **Out:** surviving a server restart (Sky Team 12).

## Technical tasks

1. Token in `localStorage`; `room:rejoin` restores the seat on reload, reconnect or tab return.
2. Presence: status bar dot, plus a message if the partner is still gone after 3 s.
3. Idempotency: a repeated `game:place` for an already-placed die is a no-op; the client never sends the same request twice while one is pending; both "Fly again" presses start one game.
4. Sweep rooms nobody is connected to after `ROOM_TTL_MINUTES` (30); `ROOMS_PER_IP` (5) caps live rooms per creator IP (`TRUST_PROXY=1` behind a proxy).
5. `room:leave` with confirmation frees the seat; the partner's game restarts; empty rooms are deleted. Closing the tab only marks you offline.

## Checklist

- [x] Reconnect: token in `localStorage`, `room:rejoin` restores the seat (reload, reconnect, or a phone tab coming back)
- [x] Presence indicator when the partner drops: status bar dot, plus a message after 3 s ("lost connection", then "is back")
- [x] Idempotent moves, single pending request per action, one game for two "Fly again" presses
- [x] Room cleanup: idle rooms removed after 30 minutes (swept every minute); at most 5 live rooms per creator IP (`too-many-rooms`)
- [x] Leaving mid-game: `room:leave` frees the seat; the partner is told and waits for someone new; both leaving deletes the room

**Done when:** refreshing either tab mid-round resumes the game exactly. ✅ Verified Sep 29, 2026: in Chromium (desktop + emulated iPhone 13) reloading each tab mid-round showed identical dice, placed dice, turn and round; plus drop/return and leave flows. 155 tests pass.
