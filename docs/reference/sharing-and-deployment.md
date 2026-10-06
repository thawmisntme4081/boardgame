# Sharing and deployment

[← Master plan](../PLAN.md)

## Sharing a local game (Cloudflare tunnel)

Until the game is deployed ([Sky Team 13](../epics/sky-team/phase-13-deploy.md)), you can play with a friend anywhere by running the production build on your computer and opening a temporary public link to it. In Claude Code, just say **"run tunnel"** (and **"stop sharing"** when done).

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
- The link works only while both terminals run and the computer is awake; each new tunnel gets a new address. Restarting the server ends games in progress unless `DATA_DIR` is set (then they are saved in `DATA_DIR/boardgames.sqlite` and continue after a restart: [Sky Team 12](../epics/sky-team/phase-12-persistence.md)).
- When Claude Code runs the tunnel, its background jobs have a time limit; for long sessions run the two terminals yourself.
- Quick tunnels are free, need no account and have no uptime guarantee: fine for an evening of games, not a permanent address.

## Deployment

Ship one Docker image running one Node process that serves the built React files and Socket.IO on the same port; run a single instance (one SQLite file on one volume).

**Build**

1. `pnpm -r build`: Vite outputs `client/dist`, `tsc` outputs `server/dist`.
2. Express serves `client/dist` as static files with a fallback to `index.html` for `/r/:code` links (`clientDir` in `app.ts`).
3. Same origin for page and socket, so no CORS setup is needed in production.

The real files: [`Dockerfile`](../../Dockerfile) (multi-stage: build everything, keep only the server's production packages, add Litestream), [`deploy/start.sh`](../../deploy/start.sh) (restores the last backup onto an empty volume, then runs the server under Litestream), [`deploy/litestream.yml`](../../deploy/litestream.yml) and [`fly.toml`](../../fly.toml).

**Hosting options** (all run a long-lived Node process with WebSockets):

| Host | Deploy from | Notes (checked Sep 2026) |
| --- | --- | --- |
| Render | GitHub repo or Dockerfile | Free tier: sleeps after 15 min with no HTTP or WebSocket traffic, ~1 min to wake, may restart anytime; no persistent disk. Best for testing |
| Railway | GitHub repo or Dockerfile | $5 one-time trial, then Free plan with $1/month credit (0.5 GB RAM); Hobby $5/month; volumes available |
| Fly.io | `fly deploy` with Dockerfile | No free tier for new accounts; ~$2/month for the smallest always-on machine; volumes available. Singapore region is close to Vietnam |

Check each host's current pricing and sleep rules before choosing; a sleeping or restarting free instance drops live games.

## Chosen hosting: private site on Fly.io

Decided Oct 4, 2026 (built in [Sky Team 13](../epics/sky-team/phase-13-deploy.md), storage in [Sky Team 12](../epics/sky-team/phase-12-persistence.md)):

| Piece | Choice |
| --- | --- |
| App | One Fly.io machine (512 MB–1 GB, shared CPU) in the region nearest the players (`sin`), **at most one machine** |
| Auto stop/start | `auto_stop_machines = "suspend"` (or `"stop"`), `auto_start_machines = true`, `min_machines_running = 0`: the machine runs only while someone is connected; the first visit after idle waits a moment while it wakes |
| Database | SQLite in a file on a 1 GB Fly volume (`DATA_DIR=/data`), through Drizzle |
| Backups | Litestream replicating to object storage (Cloudflare R2 free tier, or Fly Tigris) |

**What the database holds (Platform 04):** the live rooms (`rooms`) and every match as a log (`matches`, `match_seats`, `match_moves`, `match_snapshots`; see [architecture](architecture.md)). Finished matches stay, for history and replay. A Sky Team match takes about 30 KB (measured Oct 6, 2026 on 20 random games: about 60 changes and 3–4 snapshots of 4–9 KB each; 28 KB per match in the file), so the 1 GB volume holds some thirty thousand matches; prune old ones if it ever fills. The first start after deploying Platform 04 migrates the schema by itself and converts the rooms saved by the previous version, so games in progress continue; rejoin tokens are stored only as hashes from then on.
| Access | A shared site password (`SITE_PASSWORD`, decided Oct 6, 2026): the page asks for it once per browser (signed cookie, 30 days, renewed on each visit; 5 wrong tries lock an address for 5 minutes) and the game connection is refused without it; `noindex` + `robots.txt`. Later, optionally: an own domain on Cloudflare with Cloudflare Access (email allowlist) |
| Errors | Sentry free plan |

**Cost:** Fly bills CPU and memory per second while the machine runs, and storage always. At 2–4 hours of play a day: about $0.50–1.50 for the machine, about $0.15 for the volume, $0 for R2, Cloudflare Access and Sentry within their free tiers, plus the domain (about $1/month): **about $1.50–2.50/month**. Always on would be about $3.50–4. Check Fly's current prices before deploying.

**While the machine is stopped nothing runs:** deadlines are stored and checked when a room or match is next loaded; idle rooms are swept on startup; notifications (if ever added) need an outside cron that wakes the app. A deploy restarts the one machine for a few seconds (players reconnect; nothing is lost).

**Move to Postgres** (and several machines) only if the site goes public or one machine is not enough: [Platform 07](../epics/platform/phase-07-scale-out.md).

**Environment variables:** `PORT` (from host), `NODE_ENV=production`, `DATA_DIR=/data` (where games are saved; without it they live in memory and a restart ends them), `ROOM_TTL_MINUTES=30` (idle time before an empty room is removed), `ROOMS_PER_IP=5`, `TRUST_PROXY=1` behind the host's proxy (reads the client IP from `X-Forwarded-For`), `ROUND_TIMER_SECONDS` (dev/tests only: shortens timed rounds; ignored in production), `LOG_LEVEL=info`, optional `SENTRY_DSN`. Site password: `SITE_PASSWORD` (Fly secret; without it the site is open). Cloudflare Access (later, with an own domain): `CF_ACCESS_TEAM_DOMAIN` (e.g. `myteam.cloudflareaccess.com`) and `CF_ACCESS_AUD` (the application's audience tag); with both set, pages and sockets without a valid Access token get 403, so `<app>.fly.dev` cannot skip the login (`/health` and `/robots.txt` stay open). Backups: `LITESTREAM_REPLICA_URL` (`s3://boardgames-backup/main`), `LITESTREAM_ENDPOINT`, `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY`. Client error tracking is a build argument: `VITE_SENTRY_DSN`.

## Going live: checklist

Tick each box as it is done. **(you)** marks what only the owner can do (accounts, payment, domain, secrets); the rest Claude can run once `flyctl` is logged in. Commands are for PowerShell (or Git Bash with `winpty` for commands that ask questions). App: `boardgames-dom-mam`; volume: `boardgames_data`; database: `/data/boardgames.sqlite`.

**1. Fly account (you)**

- [x] Sign up at fly.io and add a payment card (Dashboard → Billing)
- [x] Install `flyctl`: `iwr https://fly.io/install.ps1 -useb | iex`
- [x] `fly auth login` in PowerShell (it opens the browser; in Git Bash it hangs without `winpty`)

**2. App and volume**

- [x] `fly apps create boardgames-dom-mam` (the name in `fly.toml`'s `app = ...`)
- [x] `fly volumes create boardgames_data --region sin --size 1 --yes` (one volume, so one machine)

**3. Backup bucket (you)**

- [x] Cloudflare dashboard → R2 → create the bucket `boardgames-backup` (one bucket for the whole platform, whatever the number of games)
- [x] "Manage R2 API tokens" → a token with *Object Read & Write* on that bucket
- [x] Note the access key id, the secret and the account's S3 endpoint (`https://<account id>.r2.cloudflarestorage.com`)

**4. Backup secrets (you set the keys; never paste them in a chat)**

- [x] `fly secrets set LITESTREAM_REPLICA_URL=s3://boardgames-backup/main LITESTREAM_ENDPOINT=https://<account id>.r2.cloudflarestorage.com LITESTREAM_ACCESS_KEY_ID=<id> LITESTREAM_SECRET_ACCESS_KEY=<secret>` (or one at a time with `--stage`, then `fly secrets deploy`: a partial set would start Litestream without its keys)
- [x] Optional: `fly secrets set SENTRY_DSN=...` (server project, EU region; plus the GitHub variable `VITE_SENTRY_DSN` for the browser project)
- [x] Never set `GAME_SEED` or `E2E_HOOKS` (`fly secrets list` shows only the four Litestream secrets)
- [x] `fly logs` after the restart: no "the database is not backed up" warning; Litestream logs "snapshot written" and "wal segment written" (Oct 6, 2026)

**5. First deploy**

- [x] `fly deploy --ha=false` (one machine, not the default two) — done Oct 6, 2026
- [x] `fly status`: one machine, health check passing
- [x] `fly logs`: "server listening", "games saved on disk" (`/data/boardgames.sqlite`)
- [x] `https://boardgames-dom-mam.fly.dev/health` answers

**6. Site password (you; decided Oct 6, 2026: no domain needed)**

- [x] Choose a password and set it yourself (never paste it in a chat): `fly secrets set --app boardgames-dom-mam SITE_PASSWORD=<password>`
- [x] `https://boardgames-dom-mam.fly.dev/auth/status` answers `{"gate":true,"ok":false}` in a private window (Oct 6, 2026; a wrong password gets `wrong-password` and a game connection without the cookie is refused)
- [x] Opening the site asks for the password; the right one leads to the lobby, and a reload does not ask again
- [x] Send friends the link and the password through a private channel. To sign everyone out (someone should not have it any more), set a new password: old cookies stop working

**7. Deploys from CI (you, in GitHub)**

- [x] `fly tokens create deploy --app boardgames-dom-mam --name github-actions` → repository secret `FLY_API_TOKEN` (a repository secret, not an environment secret: the deploy job uses no environment)
- [x] Repository variable `FLY_DEPLOY` = `true` (and `VITE_SENTRY_DSN` if wanted)
- [x] A push to `main` deploys after the checks pass (first CI deploy Oct 6, 2026)

**8. Checks**

- [x] Two browsers play a round on the live site over WebSockets (`wss://…/socket.io/?transport=websocket`, not long-polling)
- [x] The machine suspends by itself when nobody is connected (seen on Oct 6, 2026)
- [x] On a phone: open the link, enter the password, create a game, play a round with a friend (Oct 6, 2026)
- [x] After about 10 minutes idle, open the link again: it wakes within a few seconds (Oct 6, 2026)
- [x] Backup restore: `fly ssh console -C "litestream restore -config /etc/litestream.yml -o /tmp/check.sqlite /data/boardgames.sqlite"`, then `fly ssh console -C "ls -l /tmp/check.sqlite /data/boardgames.sqlite"` shows the same size; clean up with `fly ssh console -C "sh -c 'rm -f /tmp/check.sqlite*'"` (done Oct 6, 2026: same size, SQLite integrity check ok)

**9. Billing (you)**

- [ ] Check the 'current month to date bill' in the Fly dashboard now and then (Fly has no billing alerts, per its cost-management docs; if the organization's Billing page shows a Budgets option, set one, e.g. $5/month)
- [ ] Check the first month's bill (expected about $1.50–2.50 plus the domain)

**10. Later, optional: own domain and Cloudflare Access** (stronger: an email allowlist instead of one shared password; about $10/year for the domain)

- [ ] Add your domain to Cloudflare
- [ ] DNS: a CNAME `play` → `boardgames-dom-mam.fly.dev`, proxied (orange cloud); SSL/TLS mode **Full (strict)**
- [ ] `fly certs add play.<your domain>`, then add the `_acme-challenge` CNAME that `fly certs show play.<your domain>` prints (DNS validation works behind the proxy)
- [ ] `fly certs show play.<your domain>` says the certificate is issued

- [ ] Zero Trust → Access → Applications → Add → Self-hosted: domain `play.<your domain>`
- [ ] Policy *Allow* with an *Emails* rule listing your friends; login method *One-time PIN*; session e.g. 30 days
- [ ] Copy the application's **Audience (AUD) tag** and your **team domain** (Zero Trust → Settings)
- [ ] `fly secrets set CF_ACCESS_TEAM_DOMAIN=<team>.cloudflareaccess.com CF_ACCESS_AUD=<aud>`
- [ ] `https://boardgames-dom-mam.fly.dev` now answers 403 (expected) and `https://play.<your domain>` asks for the email PIN

**CI/CD with GitHub Actions**

1. On every push and PR: install, typecheck, lint, unit + integration tests.
2. On push to `main`: build, run Playwright against the built server, then the `deploy` job runs `flyctl deploy --remote-only --ha=false` (Fly builds the image remotely; no Docker needed). The job only runs once the repository variable `FLY_DEPLOY` is `true` and the secret `FLY_API_TOKEN` exists (checklist group 7 above).
3. Block deploy if any step fails.
