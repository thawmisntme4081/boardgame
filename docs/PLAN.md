# Sky Team Online — Master Plan

Last restructured Oct 1, 2026. This file is the big picture only; each phase has its own file in [`phases/`](phases/) with goals, scope, tasks and a checklist, and the long-lived technical references live in [`reference/`](reference/).

## Vision

An online, cooperative, 2-player version of the board game Sky Team: a pilot and a co-pilot land a plane by placing dice in silence, each on their own device (phone, tablet or desktop). The Node server is the referee: it holds the real game state, validates every move and sends each player only what they may see.

**Principles**

- **Never trust the client.** Browsers send intents; the server checks them with the shared rules and broadcasts each player's own view (`viewFor` is the only exit).
- **Rules are pure, tested functions** in `packages/shared`, written once and used by both server and client.
- **Mobile first.** A phone in portrait is the primary screen.
- **The rulebook is the spec.** Unclear rules are asked, not guessed; numbers not printed in the booklets are marked as placeholders until verified.
- **Always shippable.** Every phase ends green: typecheck, lint, format, tests, build.

This is a personal/learning project: if it is ever published, use an original name and artwork rather than the publisher's.

## Milestones

| Milestone | Outcome | Phases | Status |
| --- | --- | --- | --- |
| **M1 — Playable online base game** | Two people finish the YUL scenario online, on phone and desktop, with reconnection and CI | 0–6 | ✅ Done (Sep 29, 2026) |
| **M2 — Complete base box** | All Flight Log scenarios, modules and Special Abilities | 7 | ✅ Built (Sep 30, 2026); last scenario tracks being entered |
| **M3 — Turbulence expansion** | The 20 expansion scenarios and their modules | 8 | ⏳ Not started (needs the rulebook) |
| **M4 — Platform features** | Games survive restarts, Vietnamese language, game history (accounts optional) | 9–11 | ⏳ Not started |
| **M5 — Public launch** | The game on a public URL, monitored | 12 | ⏳ Not started |

## Phases

| # | Phase | Milestone | Status | Effort |
| --- | --- | --- | --- | --- |
| 0 | [Project setup](phases/phase-00-setup.md) | M1 | ✅ Done | — |
| 1 | [Core rules in `shared`](phases/phase-01-core-rules.md) | M1 | ✅ Done | — |
| 2 | [Server and rooms](phases/phase-02-server-rooms.md) | M1 | ✅ Done | — |
| 3 | [Gameplay over the wire](phases/phase-03-gameplay-over-the-wire.md) | M1 | ✅ Done | — |
| 4 | [React client](phases/phase-04-react-client.md) | M1 | ✅ Done | — |
| 5 | [Robustness](phases/phase-05-robustness.md) | M1 | ✅ Done | — |
| 6 | [Tests and CI](phases/phase-06-tests-ci.md) | M1 | ✅ Done | — |
| 7 | [Base game airports and modules](phases/phase-07-base-airports-modules.md) | M2 | ✅ Done (data entry open) | — |
| 8 | [Turbulence expansion](phases/phase-08-turbulence.md) | M3 | ⏳ Not started | High |
| 9 | [Persistence](phases/phase-09-persistence.md) | M4 | ⏳ Not started | Medium-low |
| 10 | [Internationalisation (EN + VI)](phases/phase-10-i18n.md) | M4 | ✅ Done | Medium |
| 11 | [Game history and accounts](phases/phase-11-history-accounts.md) | M4 | ⏳ Not started | Low (local) / High (accounts) |
| 12 | [Deploy](phases/phase-12-deploy.md) | M5 | ⏳ Not started | Medium |

Status legend: ✅ done · 🚧 in progress · ⏳ not started.

## Dependencies and suggested order

```mermaid
flowchart LR
  P7[7 Base box] --> P8[8 Turbulence]
  P9[9 Persistence] --> P11B[11 Accounts - stage B]
  P9 --> P12[12 Deploy]
  P12 --> P11B
  P10[10 i18n]
  P11A[11 Local history - stage A]
```

- **Phase 8** needs the Turbulence rulebook and tracks before any code.
- **Phase 9** and **Phase 12** share one decision: the host decides whether SQLite (needs a persistent disk) or Redis is used.
- **Phase 10** and **Phase 11 stage A** depend on nothing else and can be done any time.
- **Phase 11 stage B** (accounts) needs persistence and the production domain.

Suggested next steps: finish Phase 7's data entry → Phase 10 or 11A (independent, quick wins) → Phase 8 once the rulebook is in hand → Phase 9 + 12 together → 11B if wanted.

## Open items carried from finished phases

- [ ] Phase 7: the remaining base-box scenario tracks from the physical tiles (Wind Ring and red/black altitude track confirmed Oct 1, 2026).

## How to work with this plan

1. Pick the next phase from the table; read its file; build it task by task.
2. Tick checklist items in the **phase file** as they are completed. Leave unfinished items unticked with a reason.
3. When a phase's "Done when" check passes (plus `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`), add "✅ Verified <date>" to its "Done when" line and update its status here.
4. Keep the [reference docs](#reference) and `CLAUDE.md` in sync with the code.
5. New ideas go into the matching phase file, or a new phase file linked from the table above.

## Reference

- [Architecture](reference/architecture.md): stack, data flow, repository layout, handler pattern.
- [Game state and rules](reference/game-rules.md): files, base-game numbers, modules, abilities, placeholders, assumptions.
- [Socket.IO protocol](reference/protocol.md): events, acks, hidden information, idempotency.
- [Responsive UI](reference/ui.md): layouts per screen size, touch and mobile behaviour.
- [Testing strategy](reference/testing.md): test layers, rules for tests, device checks.
- [Sharing and deployment](reference/sharing-and-deployment.md): Cloudflare tunnel, Docker, hosts, environment variables.

## Risks

| Risk | Mitigation |
| --- | --- |
| Rule misread or edge case missed | Rulebook as the spec; one test per rule; random-play fuzzing on every scenario |
| Board data not in any booklet | Mark placeholders; read values off the physical tiles; tests independent of the data |
| Partner's dice leak to the client | `viewFor` is the only exit; leak checks on every view in integration tests |
| Player refreshes or loses connection | Reconnect tokens + full view on rejoin |
| Server restart ends live games | Phase 9 persistence |
| Free host sleeps or restarts mid-game | Pick a host that stays awake (Phase 12) |
| Scope creep as the project grows | One file per phase, explicit "In/Out" scope, milestones |
| Publishing someone else's IP | Original name and art if it goes public |
