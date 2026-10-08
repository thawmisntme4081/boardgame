# Epic: Sky Team

[← Master plan](../../PLAN.md) · **Status: ✅ Done**

## Goal

An online, cooperative, 2-player version of the board game Sky Team: a pilot and a co-pilot land a plane by placing dice in silence, each on their own device (phone, tablet or desktop). Complete with every scenario and module of the base box and the Turbulence expansion, three languages, saved games, and a private deployment friends can use any time.

**Epic done when:** Sky Team 13 (deploy) is verified: a friend in another city enters the site password and plays a full game on the private site.

## Phases

| # | Phase | Status | Effort |
| --- | --- | --- | --- |
| 01 | [Project setup](phase-01-setup.md) | ✅ Done | — |
| 02 | [Core rules in `shared`](phase-02-core-rules.md) | ✅ Done | — |
| 03 | [Server and rooms](phase-03-server-rooms.md) | ✅ Done | — |
| 04 | [Gameplay over the wire](phase-04-gameplay-over-the-wire.md) | ✅ Done | — |
| 05 | [React client](phase-05-react-client.md) | ✅ Done | — |
| 06 | [Robustness](phase-06-robustness.md) | ✅ Done | — |
| 07 | [Tests and CI](phase-07-tests-ci.md) | ✅ Done | — |
| 08 | [Base game airports and modules](phase-08-base-airports-modules.md) | ✅ Done | — |
| 09 | [Turbulence expansion](phase-09-turbulence.md) | ✅ Done | High |
| 10 | [I18n (EN + VI + FR)](phase-10-i18n.md) | ✅ Done | Medium (FR: low-medium) |
| 11 | [Game history (local)](phase-11-history.md) | ✅ Done | Low |
| 12 | [Persistence](phase-12-persistence.md) | ✅ Done | Medium-low |
| 13 | [Deploy](phase-13-deploy.md) | ✅ Done | Medium |

Milestones reached: playable online base game (01–07); complete base box (08); Turbulence expansion (09); live on the private site `https://boardgames-dom-mam.fly.dev` (13). Epic done; one follow-up left open: the first month's Fly bill (Sky Team 13).

## Order and dependencies

- 12 (persistence) and 13 (deploy) go together: the host decides the storage (SQLite on a Fly volume).
- Keep 12's store behind an interface: [Platform 04](../platform/phase-04-match-log.md) turns it into the platform's move log.
- After this epic, the [Platform epic](../platform/EPIC.md) refactors Sky Team onto a game-agnostic core; Sky Team must play exactly as before.
