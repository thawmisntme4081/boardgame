# Board Game Platform — Master Plan

Restructured Oct 5, 2026 into **epics**: one per game, plus one for the shared platform. Each epic has its own folder in [`epics/`](epics/) with an `EPIC.md` (goal, phase table, dependencies, "Epic done when") and one file per phase (goals, scope, tasks, checklist, "Done when"). Phases are numbered from 01 inside each epic and named after it: "Sky Team 12", "Platform 04". Long-lived technical references live in [`reference/`](reference/); the platform design is in [`proposals/`](proposals/).

## Vision

A private web platform, like Board Game Arena, where friends play board games together, each on their own device (phone, tablet or desktop). It starts with **Sky Team** (a cooperative 2-player game: a pilot and a co-pilot land a plane by placing dice in silence) and grows to more games: a small second game first, then Pandemic, Isle of Skye and Twilight Struggle. The Node server is the referee: it holds the real game state, validates every move and sends each player only what they may see.

**Principles**

- **Never trust the client.** Browsers send intents; the server checks them with the game's rules and sends each player their own view (`viewFor`, later `definition.view`, is the only exit).
- **Rules are pure, tested functions**, written once and used by both server and client.
- **Mobile first.** A phone in portrait is the primary screen.
- **The rulebook is the spec.** Unclear rules are asked, not guessed; numbers not printed in the booklets are marked as placeholders until verified.
- **Always shippable.** Every phase ends green: typecheck, lint, format, tests, build.

This is a personal/learning project on a private, invite-only site: if it is ever published, use original names and artwork, or the publishers' permission.

## Epics

| Epic | Goal | Phases | Status | Needs |
| --- | --- | --- | --- | --- |
| [Sky Team](epics/sky-team/EPIC.md) | Sky Team complete (base box, Turbulence, 3 languages, history, saved games) and deployed privately | 01–13 | 🚧 In progress (01–11 done) | — |
| [Platform](epics/platform/EPIC.md) | A game-agnostic core: engine contract, moves, protocol, match log, client shell, accounts | 01–07 | ⏳ Not started | Sky Team |
| [Second game](epics/second-game/EPIC.md) | A small 2–4 player game with simultaneous moves, proving the platform | 01 | ⏳ Not started | Platform 01–05 |
| [Pandemic](epics/pandemic/EPIC.md) | Pandemic, 2–4 players co-op | planned | ⏳ Not started | Platform, Second game |
| [Isle of Skye](epics/isle-of-skye/EPIC.md) | Isle of Skye, 2–5 players | planned | ⏳ Not started | Platform, Second game |
| [Twilight Struggle](epics/twilight-struggle/EPIC.md) | Twilight Struggle, 2 players, long games | planned | ⏳ Not started | Platform, Second game |

Status legend: ✅ done · 🚧 in progress · ⏳ not started.

## Order

```mermaid
flowchart LR
  ST[Sky Team 01–11 ✅] --> ST12[Sky Team 12 Persistence] --> ST13[Sky Team 13 Deploy]
  ST13 --> P1[Platform 01–03<br/>contract, moves, protocol]
  P1 --> P4[Platform 04 Match log] --> P5[Platform 05 Client shell]
  P5 --> P6[Platform 06 Accounts]
  P5 --> G2[Second game]
  G2 --> BIG[Pandemic · Isle of Skye · Twilight Struggle]
  P4 -.-> P7[Platform 07 Scale-out<br/>only if needed]
```

- **Sky Team first** (decided Oct 4, 2026): Sky Team 12–13 finish and ship Sky Team before the platform work starts.
- **Hosting and storage decided (Oct 4, 2026):** a private site on one Fly.io machine with auto stop/start, SQLite on a Fly volume (Drizzle, Litestream backups), Cloudflare Access in front; about $1.50–2.50/month plus the domain. This holds for the whole platform; Postgres only if Platform 07 happens.
- **Platform 01–03 are a refactor:** Sky Team must play exactly as before at the end of each.
- **Large games** come one epic at a time, after the second game has proved the platform; their order is open.

Suggested next steps: Sky Team 12 + 13 together → Platform 01–06 → Second game → the large games.

## Game epic template

Every new game epic follows the same shape (as Sky Team did); online play, saving and accounts come from the Platform epic, so game epics are lighter than Sky Team's:

| # | Phase | Content |
| --- | --- | --- |
| 01 | Rules core | `GameDefinition`, pure rules, tests, random play through the engine test kit |
| 02 | Setup and variants | scenarios, player counts, options |
| 03 | Board and client | the game's `Board`, `SetupForm`, `Summary`; phone, tablet, desktop |
| 04 | Translations | EN, VI, FR |
| 05+ | Expansions | extra modules and content, like Sky Team's Turbulence |

A new epic gets a folder `epics/<game>/` with an `EPIC.md` and a row in the table above; each phase gets its `phase-NN-<name>.md` file when it starts.

## How to work with this plan

1. Pick the next phase from the suggested order; read its epic's `EPIC.md` and the phase file; build it task by task.
2. Tick checklist items in the **phase file** as they are completed. Leave unfinished items unticked with a reason.
3. When a phase's "Done when" check passes (plus `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`), add "✅ Verified <date>" to its "Done when" line and update its status in the epic's `EPIC.md` (and the epic's status here when it changes).
4. Keep the [reference docs](#reference) and `CLAUDE.md` in sync with the code.
5. New ideas go into the matching phase file, a new phase in the right epic, or a new epic.

## Reference

- [Architecture](reference/architecture.md): stack, data flow, repository layout, handler pattern.
- [Game state and rules](reference/game-rules.md): Sky Team's files, numbers, modules, abilities, placeholders, assumptions.
- [Socket.IO protocol](reference/protocol.md): events, acks, hidden information, idempotency.
- [Responsive UI](reference/ui.md): layouts per screen size, touch and mobile behaviour.
- [Testing strategy](reference/testing.md): test layers, rules for tests, device checks.
- [Sharing and deployment](reference/sharing-and-deployment.md): Cloudflare tunnel, chosen hosting, Docker, environment variables.
- [Multi-game platform proposal](proposals/multi-game-platform.md): target architecture for the Platform epic.

## Risks

| Risk | Mitigation |
| --- | --- |
| Rule misread or edge case missed | Rulebook as the spec; one test per rule; random-play fuzzing on every scenario |
| Board data not in any booklet | Mark placeholders; read values off the physical pieces; tests independent of the data |
| Hidden information leaks to a client | One view function per game is the only exit; leak checks on every view (engine test kit) |
| Player refreshes or loses connection | Reconnect tokens + full view on rejoin |
| Server restart ends live games | Sky Team 12 persistence, then the match log (Platform 04) |
| Fly machine stopped when a timer is due | Deadlines stored in the game and checked on load; notifications from an outside cron |
| Platform shaped by one game | The contract is designed against all target games; the second game proves it before a large one |
| Scope creep as the project grows | One epic per game, one file per phase, explicit "In/Out" scope |
| Publishing someone else's IP | Private, invite-only site; original names and art (or permission) if it ever goes public |
