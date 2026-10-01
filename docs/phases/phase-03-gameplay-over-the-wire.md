# Phase 3: Gameplay over the wire

[← Master plan](../PLAN.md) · Milestone M1 · **Status: ✅ Done (Sep 28, 2026)**

## Goals

- A full game playable by two socket clients, with the server as the only referee.
- Proof that no payload ever leaks the partner's dice.

## Feature scope

- **In:** `game:place`, per-seat views after every change, round resolution and game-over broadcast, rerolls, rematch.
- **Out:** UI (Phase 4). In-game chat was built, then removed at the user's request.

## Technical tasks

1. `game:place` handler using the shared rules; rule reasons in the ack; illegal moves change nothing.
2. Emit `viewFor` to each seat after every change.
3. Every view carries `phase`, `endReason`, `landingFailures`.
4. `game:spend-reroll`, `game:reroll`, `game:rematch`.
5. Integration test: the shared random agent plays a full game over two real sockets, compared with an in-process game after every action, with every pair of views checked for leaks.

## Checklist

- [x] `game:place` handler using the shared rules (rule reasons returned in the ack; illegal moves change nothing)
- [x] `viewFor` filtering, emitted to each seat after every change
- [x] ~~Chat locked during `placing`~~ Built, then removed Sep 28, 2026 at the user's request: players talk outside the app
- [x] Round resolution and game over broadcast (every view carries `phase`, `endReason`, `landingFailures`)
- [x] Reroll events: `game:spend-reroll`, `game:reroll`
- [x] `game:rematch`: fresh game in the same room once the game is over (either player can start it)

**Done when:** a scripted two-client test plays a full game over sockets and no payload ever contains the partner's dice values. ✅ Verified Sep 28, 2026: 110 tests pass (seed 1: 6 rounds, over 40 actions; plus a broadcast landing win).

## Notes

The in-process vs. socket comparison found a `-0` coffee delta from `legalMoves` (JSON turns it into `0`); fixed in `rules.ts`. The careful random agent never wins on the real YUL track (0 wins in 3,000 games), so the win is tested from a prepared final round.
