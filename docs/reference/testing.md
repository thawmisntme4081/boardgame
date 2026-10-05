# Testing strategy

[← Master plan](../PLAN.md)

Most bugs in a board game are rule bugs, so the bulk of tests sit on the pure `shared` functions, with fewer, slower tests further out.

| Layer | Tool | What it covers | Runs |
| --- | --- | --- | --- |
| Unit | Vitest | Every rule, module and ability, `viewFor`, scenarios | Every save, every push |
| Property / fuzz | Vitest + fast-check | Random legal games on every scenario never throw and keep invariants; dice never leak | Every push |
| Integration | Vitest + `socket.io-client` | Real server on a random port, two clients: join, play, reconnect, illegal moves rejected; a restart on the same SQLite file mid-game (identical views after rejoining; a timed round whose deadline passed while down ends at once) | Every push |
| Component | React Testing Library | Dice tray, valid-slot highlighting, module panels, dialogs, lobby | Every push |
| End-to-end | Playwright | Two browser contexts on Desktop Chrome, iPhone 13 (WebKit), Pixel 7: lobby, full game, landing, refresh, leaving, module games | Every push to `main` and every PR (after the `check` job) |
| Lighthouse | Lighthouse CI | Mobile audit of the lobby and invite page | CI (Linux) only |
| Manual | Two machines | Latency, reconnects on mobile data, UX feel | Before each release |

## Rules for tests

- **Determinism:** tests pass a fixed seed to `createGame`, so dice rolls are known and failures reproduce. E2E runs with `GAME_SEED=1`.
- **Independent of scenario data:** module tests build their own scenario (`testScenario` / `makeView({ scenario: { modules: [...] } })`); tests that need a selectable scenario pick the first active one that matches. Editing `scenarios.ts` must not break tests.
- **Security:** send moves out of turn, for the wrong seat, with a die you don't own, with a malformed payload, and assert state is unchanged. Every `game:view` in the integration suite is checked for leaked partner dice.
- **Every scenario is winnable:** a test wins each scenario's final round from a prepared state, module landing conditions included.

## Local and device checks

- Local multiplayer: one normal window and one incognito window, or Playwright's `browser.newContext()` twice.
- Real devices on your LAN: `pnpm dev:lan`, open the Network URL on the phone; debug iOS with Safari Web Inspector and Android with `chrome://inspect`.
- Backgrounding: switch apps mid-round on a phone and confirm the game resumes.

## Commands

`pnpm test` (Vitest), `pnpm e2e` (Playwright; builds and starts the server on port 3100 with `GAME_SEED=1`, `E2E_HOOKS=1`, `ROOMS_PER_IP=1000`), `pnpm lighthouse` (CI only), `pnpm --filter @sky/shared random-play [games] [firstSeed] [scenario id | all]`.
