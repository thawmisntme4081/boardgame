# Sky Team 13: Deploy

[← Sky Team epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: 🚧 In progress: repository side done (Oct 5, 2026); the account steps of the [runbook](../../reference/sharing-and-deployment.md#going-live-checklist) are left** · Effort: **medium**

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
8. Private site: a shared site password (decided Oct 6, 2026, instead of buying a domain): `SITE_PASSWORD` as a Fly secret; the page asks for it once per browser and the game connection is refused without it (`siteGate.ts`, `SitePassword` screen), plus `noindex` and a `robots.txt` that disallows everything. Cloudflare Access (own domain, email allowlist) stays possible later and works alongside it.
9. Cost check after the first month (expected about $1.50–2.50 plus the domain); Fly's billing alerts on.

## Checklist

- [x] The server serves the built client (`client/dist`) with an `index.html` fallback for `/r/:code` links (done in Sky Team 07)
- [x] Host chosen: Fly.io, one machine, auto stop/start, SQLite volume (Oct 4, 2026)
- [x] `fly.toml` (Singapore, auto stop/start with suspend, `/health` check, 512 MB, volume `boardgames_data` at `/data`)
- [x] Fly app `boardgames-dom-mam` and volume `boardgames_data` (1 GB, `sin`, encrypted, daily snapshots kept 5 days; it replaced the first volume `sky_data` on Oct 6, 2026, as Fly volumes cannot be renamed) created; first deploy with `--ha=false` (one machine) on Oct 6, 2026: image built remotely (114 MB), `https://boardgames-dom-mam.fly.dev` live
- [x] Dockerfile and production build (with Litestream): `Dockerfile`, `deploy/start.sh`, `deploy/litestream.yml`, `.dockerignore`. The production-only install and start were checked in a scratch copy (no Docker here); the first real image build is Fly's remote builder
- [x] Litestream backup to object storage and a tested restore (moved here from Sky Team 12): R2 bucket `boardgames-backup`, path `main`; snapshot and WAL segments written; a restore on the machine gave a copy of the same size with SQLite's integrity check ok (Oct 6, 2026). The slim image lacked root certificates, so Litestream could not verify R2's HTTPS certificate: the Dockerfile now installs `ca-certificates`
- [ ] Production environment variables set; test-only settings absent (`fly.toml` `[env]` and the Litestream secrets done; the Access secrets come with the login gate)
- [x] CI deploy step after green checks (`deploy` job after `e2e`; off until the repository variable `FLY_DEPLOY` is `true` and the secret `FLY_API_TOKEN` exists — checklist group 7)
- [x] `/health` returns 200 and the host's health check uses it (`fly status`: 1 total, 1 passing)
- [x] WebSocket transport actually used (not long-polling only): a live two-browser round used `wss://…/socket.io/?transport=websocket`
- [x] Structured logs (pino): server start, rooms created/joined/left, seats rejoined, games ended, rejected moves, failed handlers; `LOG_LEVEL`; no tokens logged
- [ ] Error tracking (Sentry) on client and server (code ready, off until `SENTRY_DSN` / build argument `VITE_SENTRY_DSN` are set; without a DSN the client bundle has no Sentry code)
- [ ] Custom domain + HTTPS
- [ ] Original name and artwork if published publicly
- [x] Public or private decided: private (Oct 4, 2026)
- [x] `noindex` in place (`X-Robots-Tag` header, robots meta tag, `/robots.txt`)
- [x] The server checks the Cloudflare Access token on pages and socket handshakes (`access.ts`, `CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD`), so `<app>.fly.dev` cannot skip the login; `/health` and `/robots.txt` stay open
- [x] Site password gate (`siteGate.ts`: `/auth/status`, `/auth/login`, signed httpOnly cookie for 30 days renewed on each visit, 5 wrong tries lock an address for 5 minutes, a new password signs everyone out; the socket handshake needs the cookie; `SitePassword` screen in EN/VI/FR; an invite link `/r/CODE` survives the password screen). Checked with real browsers against the built server and deployed (off until the secret is set)
- [x] `SITE_PASSWORD` set on Fly (Oct 6, 2026): `/auth/status` says the gate is on, a wrong password is refused, and a game connection without the cookie is refused on the live site
- [ ] Optional later: own domain + Cloudflare Access — checklist group 10
- [ ] Wake-up after idle checked on a phone (first load within a few seconds)
- [ ] First month's bill checked

**Done when:** a friend in another city enters the site password and plays a full game on `https://boardgames-dom-mam.fly.dev`, and the machine stops by itself afterwards.
