# Sky Team 13: Deploy

[← Sky Team epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started (server already serves the built client)** · Effort: **medium**

## Goals

- The game on a private URL that friends can open any time, without the developer's computer running.
- Safe production settings and basic observability.

## Feature scope

- **In:** Docker image, hosting, CI deploy, health checks, logs, error tracking, custom domain + HTTPS.
- **Out:** several instances ([Platform 07](../platform/phase-07-scale-out.md)).

Hosting decision (Oct 4, 2026): a private site on **one Fly.io machine with auto stop/start** and **SQLite on a Fly volume**, backed up with Litestream, behind Cloudflare Access (about $1.50–2.50/month plus the domain). See [sharing and deployment](../../reference/sharing-and-deployment.md#chosen-hosting-private-site-on-flyio).

Moved to the end of the Sky Team epic on Sep 29, 2026 (the Platform epic comes after it): until then, games are played locally or over a temporary Cloudflare tunnel (see [sharing and deployment](../../reference/sharing-and-deployment.md)).

## Technical tasks

1. Fly.io app in the region nearest the players (Singapore, `sin`, for Vietnam): one machine (512 MB–1 GB, shared CPU), **at most one machine** (the SQLite volume belongs to one machine), a 1 GB volume mounted at `/data`. `fly.toml`: `auto_stop_machines = "suspend"` (or `"stop"`), `auto_start_machines = true`, `min_machines_running = 0`; the health check on `/health`.
2. Dockerfile (multi-stage build; one Node process serves `client/dist` and Socket.IO), with Litestream wrapping the Node process (restore on boot if the volume is empty, then replicate).
3. Environment (Fly secrets): `NODE_ENV=production`, `TRUST_PROXY=1`, `DATA_DIR=/data`, `ROOM_TTL_MINUTES`, `ROOMS_PER_IP`, `LOG_LEVEL`, Litestream bucket credentials, optional `SENTRY_DSN`; never `GAME_SEED` or `E2E_HOOKS`.
4. CI/CD: on push to `main`, build + Playwright, then `fly deploy`; block on any failure. A deploy restarts the one machine (a few seconds; players reconnect, nothing is lost): deploy when nobody is playing.
5. Observability: structured logs (pino) for room created/joined/ended and rejected moves; Sentry on client and server.
6. Custom domain + HTTPS.
7. Before publishing beyond friends: an original name and artwork instead of the publisher's.
8. Private site (decided Oct 4, 2026): the domain on Cloudflare, proxied to the Fly app, with Cloudflare Access (email allowlist, one-time PIN), plus `noindex` and a `robots.txt` that disallows everything. Check that WebSockets and the Access cookie work through the proxy.
9. Cost check after the first month (expected about $1.50–2.50 plus the domain); Fly's billing alerts on.

## Checklist

- [x] The server serves the built client (`client/dist`) with an `index.html` fallback for `/r/:code` links (done in Sky Team 07)
- [x] Host chosen: Fly.io, one machine, auto stop/start, SQLite volume (Oct 4, 2026)
- [ ] Fly app, volume and `fly.toml` (auto stop/start, at most one machine)
- [ ] Dockerfile and production build (with Litestream)
- [ ] Litestream backup to object storage and a tested restore (moved here from Sky Team 12: Litestream runs in the Linux image and has no Windows build)
- [ ] Production environment variables set; test-only settings absent
- [ ] CI deploy step after green checks
- [ ] `/health` returns 200 and the host's health check uses it
- [ ] WebSocket transport actually used (not long-polling only)
- [ ] Structured logs (pino)
- [ ] Error tracking (Sentry) on client and server
- [ ] Custom domain + HTTPS
- [ ] Original name and artwork if published publicly
- [x] Public or private decided: private (Oct 4, 2026)
- [ ] Cloudflare Access allowlist and `noindex` in place
- [ ] Wake-up after idle checked on a phone (first load within a few seconds)
- [ ] First month's bill checked

**Done when:** a friend in another city signs in through Cloudflare Access and plays a full game on the private URL, and the machine stops by itself afterwards.
