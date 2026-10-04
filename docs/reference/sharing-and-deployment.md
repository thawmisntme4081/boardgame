# Sharing and deployment

[← Master plan](../PLAN.md)

## Sharing a local game (Cloudflare tunnel)

Until the game is deployed ([Phase 12](../phases/phase-12-deploy.md)), you can play with a friend anywhere by running the production build on your computer and opening a temporary public link to it. In Claude Code, just say **"run tunnel"** (and **"stop sharing"** when done).

**Run it yourself** (two PowerShell terminals in the project folder):

Terminal 1, the game server:

```powershell
pnpm build
$env:NODE_ENV = 'production'
$env:TRUST_PROXY = '1'
pnpm start
```

Wait for `server listening on http://localhost:3000`.

Terminal 2, the tunnel:

```powershell
cloudflared tunnel --url http://localhost:3000
```

It prints a line with `https://<random-words>.trycloudflare.com`: that is the link. If `cloudflared` is not found, open a new terminal or use `& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000`. (Install once with `winget install Cloudflare.cloudflared`.)

**Play:** open the link yourself (not `localhost`) and create the game, so **Share invite** gives the public address; send it, or just the 4-letter code.

**Stop:** Ctrl+C in both terminals.

Good to know:

- `pnpm build` is only needed again after the code changes.
- The `$env:` lines last for that terminal window only. `NODE_ENV=production` keeps the test-only settings (`GAME_SEED`, `E2E_HOOKS`) off; `TRUST_PROXY=1` makes the 5-rooms-per-address limit count each player's real address instead of everyone arriving through the tunnel as one.
- The link works only while both terminals run and the computer is awake; each new tunnel gets a new address. Restarting the server ends games in progress (they are kept in memory until [Phase 11](../phases/phase-11-persistence.md)).
- When Claude Code runs the tunnel, its background jobs have a time limit; for long sessions run the two terminals yourself.
- Quick tunnels are free, need no account and have no uptime guarantee: fine for an evening of games, not a permanent address.

## Deployment

Ship one Docker image running one Node process that serves the built React files and Socket.IO on the same port; run a single instance while game state lives in memory.

**Build**

1. `pnpm -r build`: Vite outputs `client/dist`, `tsc` outputs `server/dist`.
2. Express serves `client/dist` as static files with a fallback to `index.html` for `/r/:code` links (`clientDir` in `app.ts`).
3. Same origin for page and socket, so no CORS setup is needed in production.

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm -r build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app .
EXPOSE 3000
CMD ["node", "packages/server/dist/index.js"]
```

**Hosting options** (all run a long-lived Node process with WebSockets):

| Host | Deploy from | Notes (checked Sep 2026) |
| --- | --- | --- |
| Render | GitHub repo or Dockerfile | Free tier: sleeps after 15 min with no HTTP or WebSocket traffic, ~1 min to wake, may restart anytime; no persistent disk. Best for testing |
| Railway | GitHub repo or Dockerfile | $5 one-time trial, then Free plan with $1/month credit (0.5 GB RAM); Hobby $5/month; volumes available |
| Fly.io | `fly deploy` with Dockerfile | No free tier for new accounts; ~$2/month for the smallest always-on machine; volumes available. Singapore region is close to Vietnam |

Check each host's current pricing and sleep rules before choosing; a sleeping or restarting free instance drops live games.

## Chosen hosting: private site on Fly.io

Decided Oct 4, 2026 (built in [Phase 12](../phases/phase-12-deploy.md), storage in [Phase 11](../phases/phase-11-persistence.md)):

| Piece | Choice |
| --- | --- |
| App | One Fly.io machine (512 MB–1 GB, shared CPU) in the region nearest the players (`sin`), **at most one machine** |
| Auto stop/start | `auto_stop_machines = "suspend"` (or `"stop"`), `auto_start_machines = true`, `min_machines_running = 0`: the machine runs only while someone is connected; the first visit after idle waits a moment while it wakes |
| Database | SQLite in a file on a 1 GB Fly volume (`DATA_DIR=/data`), through Drizzle |
| Backups | Litestream replicating to object storage (Cloudflare R2 free tier, or Fly Tigris) |
| Access | Domain on Cloudflare, proxied to Fly; Cloudflare Access (email allowlist, one-time PIN); `noindex` + `robots.txt` |
| Errors | Sentry free plan |

**Cost:** Fly bills CPU and memory per second while the machine runs, and storage always. At 2–4 hours of play a day: about $0.50–1.50 for the machine, about $0.15 for the volume, $0 for R2, Cloudflare Access and Sentry within their free tiers, plus the domain (about $1/month): **about $1.50–2.50/month**. Always on would be about $3.50–4. Check Fly's current prices before deploying.

**While the machine is stopped nothing runs:** deadlines are stored and checked when a room or match is next loaded; idle rooms are swept on startup; notifications (if ever added) need an outside cron that wakes the app. A deploy restarts the one machine for a few seconds (players reconnect; nothing is lost).

**Move to Postgres** (and several machines) only if the site goes public or one machine is not enough: [Phase 20](../phases/phase-20-scale-out.md).

**Environment variables:** `PORT` (from host), `NODE_ENV=production`, `ROOM_TTL_MINUTES=30` (idle time before an empty room is removed), `ROOMS_PER_IP=5`, `TRUST_PROXY=1` behind the host's proxy (reads the client IP from `X-Forwarded-For`), `ROUND_TIMER_SECONDS` (dev/tests only: shortens timed rounds; ignored in production), `LOG_LEVEL=info`, optional `SENTRY_DSN`.

**CI/CD with GitHub Actions**

1. On every push and PR: install, typecheck, lint, unit + integration tests.
2. On push to `main`: build, run Playwright against the built server, then trigger the host's deploy (deploy hook or `fly deploy`).
3. Block deploy if any step fails.
