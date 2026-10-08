# Epic: Scale-out

[← Master plan](../../PLAN.md) · **Status: ⏳ Not started (only when metrics ask for it)** · Design: [multi-game proposal](../../proposals/multi-game-platform.md), section 5

## Goal

Run the platform on several server instances, for capacity, for deploys without downtime, or once the site is public. Until one of those is needed, the single Fly machine with SQLite is the setup, and this epic stays closed.

**Epic done when:** killing one instance mid-game moves its matches to another instance, and players continue after a reconnect with identical views.

## Phases

| # | Phase | Status | Effort |
| --- | --- | --- | --- |
| 01 | [Several servers](phase-01-scale-out.md) | ⏳ Only when metrics ask | Medium |

## Order and dependencies

- Needs [Platform 01–06](../platform/EPIC.md) (the match log and the accounts both have to work across instances).
- Starts only if the site goes public or metrics show one server is not enough.
- The first step if triggered: move from SQLite to Postgres, since several machines cannot share one SQLite volume.
