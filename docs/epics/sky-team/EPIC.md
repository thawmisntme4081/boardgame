# Epic: Sky Team

[← Master plan](../../PLAN.md) · **Status: 🚧 In progress (01–12 done)**

## Goal

An online, cooperative, 2-player version of the board game Sky Team: a pilot and a co-pilot land a plane by placing dice in silence, each on their own device (phone, tablet or desktop). Complete with every scenario and module of the base box and the Turbulence expansion, three languages, saved games, and a private deployment friends can use any time.

**Epic done when:** Sky Team 13 (deploy) is verified: a friend in another city signs in through Cloudflare Access and plays a full game on the private URL.

## Phases

| # | Phase | Status | Effort |
| --- | --- | --- | --- |
| 01 | [Project setup](phase-01-setup.md) | ✅ Done | — |
| 02 | [Core rules in `shared`](phase-02-core-rules.md) | ✅ Done | — |
| 03 | [Server and rooms](phase-03-server-rooms.md) | ✅ Done | — |
| 04 | [Gameplay over the wire](phase-04-gameplay-over-the-wire.md) | ✅ Done | — |
| 05 | [React client](phase-05-react-client.md) | ✅ Done | — |
| 06 | [Robustness](phase-06-robustness.md) | ✅ Done | — |
| 07 | [Tests and CI](phase-07-tests-ci.md) | ✅ Done (Sep 29, 2026) | — |
| 08 | [Base game airports and modules](phase-08-base-airports-modules.md) | ✅ Done (Oct 2, 2026) | — |
| 09 | [Turbulence expansion](phase-09-turbulence.md) | ✅ Done (Oct 4, 2026) | High |
| 10 | [I18n (EN + VI + FR)](phase-10-i18n.md) | ✅ Done (French Oct 5, 2026) | Medium (FR: low-medium) |
| 11 | [Game history (local)](phase-11-history.md) | ✅ Done (Oct 4, 2026) | Low |
| 12 | [Persistence](phase-12-persistence.md) | ✅ Done (Oct 5, 2026) | Medium-low |
| 13 | [Deploy](phase-13-deploy.md) | ⏳ Not started | Medium |

Milestones reached: playable online base game (01–07, Sep 29, 2026); complete base box (08, Oct 2, 2026); Turbulence expansion (09, Oct 4, 2026).

## Order and dependencies

- 12 (persistence) and 13 (deploy) go together: the host decides the storage (SQLite on a Fly volume, decided Oct 4, 2026).
- Keep 12's store behind an interface: [Platform 04](../platform/phase-04-match-log.md) turns it into the platform's move log.
- After this epic, the [Platform epic](../platform/EPIC.md) refactors Sky Team onto a game-agnostic core; Sky Team must play exactly as before.
