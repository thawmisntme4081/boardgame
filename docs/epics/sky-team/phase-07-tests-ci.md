# Sky Team 07: Tests and CI

[← Sky Team epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ✅ Done**

## Goals

- Every layer covered by automated tests that run on every push.
- Real browsers on phone profiles, and a mobile Lighthouse audit, in CI.

## Feature scope

- **In:** Vitest suites (unit, property, integration, component), Playwright E2E on three devices against the production build, GitHub Actions jobs, Lighthouse CI.
- **Out:** load testing.

## Technical tasks

1. Fill gaps in the Vitest suites (unit, property, integration, component).
2. Playwright in `e2e/` against the production build (the server serves `client/dist`) on Desktop Chrome, iPhone 13 (WebKit) and Pixel 7.
3. Test-only server settings: `GAME_SEED=1`, `E2E_HOOKS=1` (`POST /__e2e/rooms/:code/game` sets up a game state), `ROOMS_PER_IP=1000`; all ignored when `NODE_ENV=production`.
4. CI: job `check` (typecheck, lint, format, Vitest, build), then job `e2e` (Chromium + WebKit, `pnpm e2e`, Lighthouse), report uploaded on failure.
5. Lighthouse mobile audit (`lighthouserc.cjs`): fails below 90 accessibility or on small touch targets.

## Checklist

- [x] Unit, property, integration and component suites (Vitest): 159 tests
- [x] Playwright E2E on Desktop Chrome, iPhone 13 (WebKit) and Pixel 7: lobby, invite link, unknown code, a full game to a crash + "Fly again", a landing from a prepared final round, refreshing mid-round, leaving and a newcomer joining, one desktop + phone game
- [x] CI workflow: `check` on every push to `main` and every PR; `e2e` after it
- [x] Suites green in GitHub Actions
- [x] Lighthouse mobile audit in CI (`pnpm lighthouse`); local run: accessibility 100, best practices 100, touch targets pass, performance 87. Runs in CI (Linux) only: `lhci` fails its temp-folder cleanup on Windows

**Done when:** unit, integration and Playwright suites are green in GitHub Actions. ✅ Verified.

See [testing strategy](../../reference/testing.md).
