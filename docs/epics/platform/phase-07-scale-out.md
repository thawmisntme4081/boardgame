# Platform 07: Scale-out

[← Platform epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started (only when metrics ask for it)** · Effort: **medium**

Design reference: [multi-game proposal](../../proposals/multi-game-platform.md), section 5 (step H).

## Goals

- Several server instances behind a load balancer, for capacity or for deploys without downtime.
- Exactly one instance applies moves to a given match.

## Feature scope

- **In:** Redis (or Valkey); the Socket.IO Redis adapter; a match-ownership lease (or routing by match id); durable timers (pg-boss or BullMQ); OpenTelemetry metrics; rolling deploys.
- **Out:** microservices; Kubernetes; bots (separate workers, if ever wanted).

**Trigger:** start only when metrics show one process is not enough, zero-downtime deploys are wanted, or the site goes public. Until then, Sky Team 13's single Fly machine with SQLite is the setup.

**First step if triggered:** move from SQLite to Postgres (several machines cannot share one SQLite volume): copy the data, switch the Drizzle driver behind `MatchStore`.

## Technical tasks

1. Metrics first: active matches, moves per second, event-loop lag, reconnects, latency.
2. SQLite → Postgres (managed, e.g. Neon or Fly Postgres) behind `MatchStore`.
3. Socket.IO Redis adapter for broadcasts across instances.
4. Match ownership: lease per match in Redis with renewal; a lost lease means the next instance loads the match from the store.
5. Durable timers so a scheduled move survives an instance dying.
6. Rolling deploys; drain connections on shutdown.

## Checklist

- [ ] Metrics and dashboards
- [ ] Postgres instead of SQLite
- [ ] Redis adapter
- [ ] Match-ownership lease
- [ ] Durable timers
- [ ] Load test (many concurrent matches) and a kill-an-instance test
- [ ] Deployment doc and `CLAUDE.md` updated (the "single server instance" rule)

**Done when:** killing one instance mid-game moves its matches to another instance, and players continue after a reconnect with identical views.
