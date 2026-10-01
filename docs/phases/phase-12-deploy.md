# Phase 12: Deploy (last)

[← Master plan](../PLAN.md) · Milestone M5 · **Status: ⏳ Not started (server already serves the built client)** · Effort: **medium**

## Goals

- The game on a public URL that friends can open any time, without the developer's computer running.
- Safe production settings and basic observability.

## Feature scope

- **In:** Docker image, hosting, CI deploy, health checks, logs, error tracking, custom domain + HTTPS.
- **Out:** several instances (only needed with Redis + sticky sessions).

Moved to the end on Sep 29, 2026: until then, games are played locally or over a temporary Cloudflare tunnel (see [sharing and deployment](../reference/sharing-and-deployment.md)).

## Technical tasks

1. Choose the host with [Phase 9](phase-09-persistence.md)'s storage in mind (Render free has no persistent disk; Railway/Fly.io volumes do).
2. Dockerfile (multi-stage build; one Node process serves `client/dist` and Socket.IO).
3. Environment: `NODE_ENV=production`, `TRUST_PROXY=1`, `ROOM_TTL_MINUTES`, `ROOMS_PER_IP`, `LOG_LEVEL`, optional `SENTRY_DSN`; never `GAME_SEED` or `E2E_HOOKS`.
4. CI/CD: on push to `main`, build + Playwright, then the host's deploy hook; block on any failure.
5. Observability: structured logs (pino) for room created/joined/ended and rejected moves; Sentry on client and server.
6. Custom domain + HTTPS.
7. Before publishing beyond friends: an original name and artwork instead of the publisher's.

## Checklist

- [x] The server serves the built client (`client/dist`) with an `index.html` fallback for `/r/:code` links (done in Phase 6)
- [ ] Host chosen (with the storage decision)
- [ ] Dockerfile and production build
- [ ] Production environment variables set; test-only settings absent
- [ ] CI deploy step after green checks
- [ ] `/health` returns 200 and the host's health check uses it
- [ ] WebSocket transport actually used (not long-polling only)
- [ ] Structured logs (pino)
- [ ] Error tracking (Sentry) on client and server
- [ ] Custom domain + HTTPS
- [ ] Original name and artwork if published publicly

**Done when:** a friend in another city plays a full game on the public URL.
