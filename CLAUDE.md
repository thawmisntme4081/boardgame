# Sky Team Online

Online 2-player, cooperative web version of the board game Sky Team (pilot + co-pilot land a plane by placing dice silently). Personal/learning project. Full plan: `docs/PLAN.md` — follow its phases in order.

## Stack (decided)

- TypeScript strict everywhere, pnpm workspaces monorepo: `packages/shared`, `packages/server`, `packages/client`
- Server: Node 20+, Express, Socket.IO, Zod for every incoming payload
- Client: React + Vite, Tailwind CSS v4 (`@tailwindcss/vite`), Zustand for the latest server view
- shadcn/ui ONLY for lobby, dialogs, toasts, tooltip/popover, select/tabs. Add components one at a time with `pnpm dlx shadcn@latest add <name>` in `packages/client`. The cockpit board, dice, tracks and alarm board are custom components (Tailwind + SVG).
- Tests: Vitest (+ fast-check fuzzing), socket.io-client integration tests, React Testing Library, Playwright E2E incl. iPhone/Pixel device profiles
- Deploy: one Docker image, one Node process serving the built client + Socket.IO on the same port. Render free tier for testing; Railway Hobby or small Fly.io machine later.

## Architecture rules (do not break)

- The server is the referee. Clients send intents only (`game:place { dieId, slot, coffeeDelta }`); the server validates with the shared rules and broadcasts.
- All game rules live as pure functions in `packages/shared` (`createGame`, `rollDice`, `canPlaceDie`, `placeDie`, `resolveRound`, `checkLanding`). No rules in React components or socket handlers. The client highlights moves with `canPlaceInView`, which runs the same `checkPlacement` on the player's view.
- `viewFor(state, seat)` is the ONLY way state leaves the server. A player never receives the partner's unplaced dice values, the RNG seed, or future rolls.
- Seedable RNG; tests use fixed seeds. Log every accepted move for replay.
- Modules only through hooks: a module's rules live in its `RuleModule` (`packages/shared/src/modules`), its slots declare `module` (or `coveredBy`) in `slots.ts`, and its state is a public `GameState` field. `rules.ts` calls hooks; it never tests for a module by name.
- No in-game chat (removed at the user's request): players talk outside the app in the strategy phase and press "Ready to roll"; do not add chat back unless asked.
- Game state is in memory for v1: run a single server instance.
- `GAME_SEED` (fixed dice), `E2E_HOOKS` (test-only `POST /__e2e/rooms/:code/game`) and `ROUND_TIMER_SECONDS` (short timed rounds) exist for tests and dev and are ignored when `NODE_ENV=production`; never enable them on a public server.
- Optional round timer (creator's choice in the lobby, off by default, 3 min): the rules own it (`startRoundTimer`, `expireRoundTimer`, `roundTimeLeft`; the deadline clears when a round or the game ends) and the server enforces it (`syncRoundTimer` timeout per room, plus a deadline check before every move). Views send the time left, never the absolute deadline; the client countdown is display only.
- Closing a tab only marks a player offline (seat kept); `room:leave` gives the seat up. Rooms nobody is connected to are swept after `ROOM_TTL_MINUTES` (30) idle; `ROOMS_PER_IP` (5) caps live rooms per creator IP (`TRUST_PROXY=1` behind a proxy).
- Repeated requests must be harmless: a duplicate `game:place` for an already-placed die is accepted as a no-op, a second rematch on a fresh game is OK, and the client never sends the same request twice while one is pending.

## UI rules

- Mobile-first. Custom Tailwind breakpoints in `@theme`: `tablet` = 600px, `desktop` = 1024px.
- Phone portrait: status bar, tracks strip, scrolling cockpit, dice tray fixed at bottom. Tablet: two columns (tracks + cockpit / dice tray). Desktop: one centred container (max 72rem): tracks side by side above the cockpit, dice tray below; not full width. Desktop cockpit: equal side columns (16%): pilot radio + landing gear on the left (switch right of slot), co-pilot radio + flaps on the right (switch left of slot); axis, engines, brakes, concentration in the centre. Below desktop the cockpit order is fixed: Axis, Engines, Landing gear, Flaps, Radio (one panel; on desktop its wrapper is `display: contents` so the pilot/co-pilot halves take their own areas), Brakes, Concentration; Radio and Brakes share a row only when the cockpit is at least 28rem wide (they wrap on phones). Column spans use `max-desktop:` so they never fight the desktop grid areas. Ordered switches (flaps, brakes) show arrows between slots. Concentration slots (either player) are half blue, half orange (`.slot-shared`). Gear, flaps and brakes show a toggle `Switch` (svgs/Switch.tsx), not a light.
- After each round's last die (game not over), a green "Next turn in 5s" countdown shows next to the turn label in every game: display only (`nextTurnAt` in the store, `NextTurnCountdown`), it does not block "Ready to roll". Countdowns share `useNow`.
- Modules: Kerosene, Wind and Intern panels sit in a grid below the main cockpit (`ModulePanels`); Ice brakes replace the Brakes panel (radio and brakes then take a full row each below desktop). Training the intern takes two taps: the Intern space, then where its token goes (`internSlot` in the store). The co-pilot's tray shows the black traffic die for Synchronisation; Adaptation, Anticipation and Working Together buttons appear under the selected die when `canUseAbilityInView` allows. The lobby and the game-over dialog share `ScenarioPicker`.
- On `visibilitychange` to visible: reconnect and `room:rejoin` with the saved token.

## Scope

- v1: base game, one airport, responsive UI, reconnection. Public deploy is the last phase (Phase 10); until then play locally or share a temporary tunnel.
- Phase 7 (done): the 21 Flight Log scenarios on 11 airports (`scenarios.ts`), modules as `RuleModule` hooks (`packages/shared/src/modules`: Kerosene, Kerosene leak, Intern, Wind, Real-time, Ice brakes), traffic die and turns on the approach track, and the six Special Abilities (`abilities.ts`). The 20 non-YUL approach tracks, `WIND_RING` and `HARD_ALTITUDES` are placeholders until read off the physical tiles; don't present them as official.
- Phase 8: Turbulence expansion (Turbulence, Low Visibility, Alarms modules, 20 scenarios).
- Phase 9: extras (persistence, accounts). Phase 10: deploy.
- Exact rule numbers must be checked against the rulebooks; the numbers in the plan are a starting model. Ask the user when a rule is unclear instead of guessing.

## Workflow

When a phase is done (its "Done when" check verified, plus `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm build` passing):

- Tick that phase's checklist in `docs/PLAN.md`. Leave unfinished items unticked and say why. Add a "✅ Verified <date>" note to its "Done when" line.
- Update the docs so they match the code: the relevant `docs/PLAN.md` sections (protocol table, game state and rules, assumptions, later phases affected by work pulled forward) and this file (stack, commands, rules) when they changed.

## Commands

- `pnpm dev` — server + Vite together
- `pnpm test` — Vitest
- `pnpm e2e` — Playwright: builds, starts the production server on port 3100 (`GAME_SEED=1`, `E2E_HOOKS=1`) and runs `e2e/` on Desktop Chrome, iPhone 13 (WebKit), Pixel 7; `pnpm exec playwright test -g "<name>" --project "Desktop Chrome"` for one test
- `pnpm -r build` — production build
- `pnpm lighthouse` — mobile Lighthouse audit of the build (Lighthouse CI; runs in CI on Linux, fails on Windows cleanup)
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` — same checks as CI
- `pnpm --filter @sky/shared random-play [games] [firstSeed] [scenario id | all]` — play random games (YUL by default) and print how they ended
- `pnpm dev:lan` — like `pnpm dev`, but Vite listens on the LAN so a phone can open the Network URL it prints
- `pnpm exec playwright install chromium` — one-time browser download for Playwright

## Shortcuts

- **"run tunnel"**: share the current build on a public link (manual steps for the user: `docs/PLAN.md`, "Sharing a local game").
  1. Check port 3000 is free; if something is listening there, say what and ask before touching it.
  2. `pnpm build`.
  3. In the background: `NODE_ENV=production TRUST_PROXY=1 PORT=3000 node packages/server/dist/index.js`; wait until `http://localhost:3000/health` answers.
  4. In the background: `"C:/Program Files (x86)/cloudflared/cloudflared.exe" tunnel --no-autoupdate --url http://localhost:3000`; read the `https://*.trycloudflare.com` URL from its output.
  5. Check `<url>/health` and `<url>/` answer through the tunnel, then give the user the link and remind them to create the game from that link (not localhost). Never set `GAME_SEED` or `E2E_HOOKS` for a tunnel.
- **"stop sharing"**: stop both background tasks, then make sure nothing is left on Windows: kill whatever listens on port 3000 (with its process tree, `taskkill /T /F`) and any `cloudflared` process; confirm port 3000 is free and no `cloudflared` runs.
