# Epic: Platform

[← Master plan](../../PLAN.md) · **Status: 🚧 In progress (01–02 done)** · Design: [multi-game proposal](../../proposals/multi-game-platform.md)

## Goal

Turn the Sky Team app into a game-agnostic platform, like Board Game Arena: players pick a game, create a table, play, and find their history, whatever the game. Sky Team becomes one game module among others. The platform owns everything that is not a rule: rooms, seats, presence, reconnection, timers, storage, accounts and the client shell; each game plugs in through one contract (`GameDefinition`).

**Epic done when:** Sky Team runs entirely through the platform (01–05, with no behaviour change for players), accounts work (06), and the [Second game epic](../second-game/EPIC.md) plays on it with no game-specific code in the platform packages.

## Phases

| # | Phase | Status | Effort |
| --- | --- | --- | --- |
| 01 | [Engine contract](phase-01-engine-contract.md) | ✅ Done (Oct 6, 2026) | Low-medium |
| 02 | [Everything is a move](phase-02-everything-is-a-move.md) | ✅ Done (Oct 6, 2026) | Medium |
| 03 | [Generic protocol](phase-03-generic-protocol.md) | ⏳ Not started | Medium |
| 04 | [Match log (persistence for every game)](phase-04-match-log.md) | ⏳ Not started | Medium |
| 05 | [Client shell and router](phase-05-client-shell.md) | ⏳ Not started | Medium-high |
| 06 | [Accounts and match history](phase-06-accounts.md) | ⏳ Not started | High |
| 07 | [Scale-out](phase-07-scale-out.md) | ⏳ Only when metrics ask | Medium |

## Order and dependencies

- Starts after the [Sky Team epic](../sky-team/EPIC.md) is deployed (decided Oct 4, 2026).
- 01–03 are a refactor: Sky Team must play exactly as before at the end of each.
- 04 replaces [Sky Team 12](../sky-team/phase-12-persistence.md)'s store with the move log.
- 06 (accounts) needs the match store (04), the router pages (05) and the production domain ([Sky Team 13](../sky-team/phase-13-deploy.md)).
- 07 starts only if the site goes public or metrics show one server is not enough; until then one Fly machine with SQLite is the setup.
