# Sky Team Online

Online 2-player, cooperative web version of the board game Sky Team (pilot + co-pilot land a plane by placing dice silently). Personal/learning project. Master plan: `docs/PLAN.md` (milestones and the phase table); each phase has its own file in `docs/phases/` (goals, scope, tasks, checklist); technical references are in `docs/reference/`. Follow the suggested order in the master plan.

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
- No in-game chat (removed at the user's request): players talk outside the app in the strategy phase and press "Roll dice"; do not add chat back unless asked.
- Game state is in memory for v1: run a single server instance.
- `GAME_SEED` (fixed dice), `E2E_HOOKS` (test-only `POST /__e2e/rooms/:code/game`) and `ROUND_TIMER_SECONDS` (short timed rounds) exist for tests and dev and are ignored when `NODE_ENV=production`; never enable them on a public server.
- Optional round timer (creator's choice in the lobby, off by default, 3 min): the rules own it (`startRoundTimer`, `expireRoundTimer`, `roundTimeLeft`; the deadline clears when a round or the game ends) and the server enforces it (`syncRoundTimer` timeout per room, plus a deadline check before every move). Views send the time left, never the absolute deadline; the client countdown is display only.
- Closing a tab only marks a player offline (seat kept); `room:leave` gives the seat up. Rooms nobody is connected to are swept after `ROOM_TTL_MINUTES` (30) idle; `ROOMS_PER_IP` (5) caps live rooms per creator IP (`TRUST_PROXY=1` behind a proxy).
- Repeated requests must be harmless: a duplicate `game:place` for an already-placed die is accepted as a no-op, a second rematch on a fresh game is OK, and the client never sends the same request twice while one is pending.

## UI rules

- Mobile-first. Custom Tailwind breakpoints in `@theme`: `tablet` = 600px, `desktop` = 1024px.
- Phone portrait: status bar, tracks strip, scrolling cockpit, dice tray fixed at bottom. Tablet: two columns (tracks + cockpit / dice tray). Desktop: one centred container (max 72rem): tracks side by side above the cockpit, dice tray below; not full width. Axis and Engines are one panel, "Axis & Engines" (`FlightInstrument`): the axis dial on the upper half, the speed 2–12 on the lower half (one segment per value, grey / blue / orange by how far the plane flies; the gaps after the blue and orange aerodynamics markers take their colour; the speed is a black dot with its number in white), and red brake sections outside the lower half (normal brakes up to 2, 4, 6; Ice brakes up to 2, 3, 4, 5); Axis spaces at the top corners, Engine spaces at the bottom ones, "+N wind" in the middle. Desktop cockpit (`desktopGrid` in `components/cockpit/layout.ts`, CSS variables on `.cockpit-grid`): Landing gear left and Flaps right share the top row (same height, set by their content); Axis & Engines spans two rows with Wind and one Radio panel (co-pilot spaces above the pilot's) beside it; Brakes (or Ice brakes) and Concentration split the centre below; Kerosene and Intern each get a full-height column left of Flaps; Alarms a row under the centre. Below desktop the cockpit order depends on the seat (`sectionOrder` in `components/cockpit/layout.ts`), every panel full width: pilot = Wind, Axis & Engines, Alarms, Landing gear, Brakes (or Ice brakes), Kerosene (or leak), Intern, Radio, Concentration, Flaps; co-pilot = Wind, Axis & Engines, Alarms, Radio, Concentration, Flaps, Ice brakes, Kerosene (or leak), Intern, Landing gear, Brakes (plain brakes go last); Radio and Concentration share a row below desktop. Column spans use `max-desktop:` so they never fight the desktop grid areas. Ordered switches (flaps, brakes) show arrows between slots. Kerosene: its space above the gauge (vertical in the desktop column). Ice brakes: a thin grey line with arrows between the rows (progress shows on the brakes arc). Concentration slots (either player) are half blue, half orange (`.slot-shared`). Gear, flaps and brakes show a toggle `Switch` (svgs/Switch.tsx), not a light. A panel hint sits behind an info icon next to the title (popover; gray, red on the mandatory Axis and Engines, whose popover also explains "Mandatory"); panels without a hint have no icon. On the approach track, a space with both a traffic die and a turn stacks them (die above, turn dots below).
- After each round's last die (game not over), a green "Next turn in 5s" countdown is the only status pill for 5 s, in every game (`nextTurnAt` in the store, `NextTurnCountdown`): the board keeps showing the finished round (`lastRound`) and "Roll dice" (in the dice tray) is disabled until it ends. While dice are placed, a red "No talking" pill sits next to the turn label. Countdowns share `useNow`.
- Modules: Kerosene and Intern panels are cockpit sections (ordered per seat below desktop; one row, half each, under the control panel on desktop); Wind is its own panel (first on phones, beside Axis & Engines on desktop); Ice brakes replace the Brakes panel (radio and brakes then take a full row each below desktop). Training the intern takes two taps: the Intern space, then where its token goes (`internSlot` in the store). The co-pilot's tray shows the black traffic die for Synchronization; Adaptation, Anticipation and Working Together buttons appear under the selected die when `canUseAbilityInView` allows. The lobby and the game-over dialog share `ScenarioPicker` (scenario only). Games start in the `setup` phase: a "Before take-off" panel above the tracks (`Preflight`) where the creator chooses the seats (`room:choose-seat`; Pilot / Co-pilot outline buttons, each player's own seat solid once chosen), the Special Ability cards are picked (two cards: one each; one card: the creator's; `game:pick-ability`), and both press Confirm (`game:confirm`); round 1, traffic die included, starts when both have confirmed (`beginGame`). The picks live on the room's players and are copied into `game.abilities`. From the round before the final one, the dice tray shows a "Win conditions" popover listing `landingConditions(scenario)` (shared rules: the base five plus each module's `landingConditions`).
- Turbulence: Alarm board panel after Engines (both seats; full row on desktop); a blocked space shows a red bell; weather icons on altitude cards and a weather note plus face-down set-aside dice in the tray; Alarm (bell) and Total Trust (muted speaker) symbols at the top corners of approach cards; Total Trust hides "Roll dice"; covered spaces (stuck gear) show a grey X.
- Text: every client string goes in `packages/client/src/locales/en.json` and `vi.json` (same keys; `useTranslation()` in components, `t` from `@/i18n` in helpers; plurals `_one`/`_other`). The server sends codes, never sentences. English is the default; `LanguageSwitch` saves each player's choice in `localStorage`. Tests run in English.
- On `visibilitychange` to visible: reconnect and `room:rejoin` with the saved token.

## Scope

- v1 (milestone M1, phases 0–6): base game, one airport, responsive UI, reconnection. Deploy is Phase 12, after the Sky Team phases; until then play locally or share a temporary tunnel.
- Phase 7 (done): 40 scenarios on 18 airports (`scenarios.ts`), modules as `RuleModule` hooks (`packages/shared/src/modules`: Kerosene, Kerosene leak, Intern, Wind, Real-time, Ice brakes), traffic die and turns on the approach track, and the six Special Abilities (`abilities.ts`). `WIND_RING` (20 spaces) and `HARD_ALTITUDES` (red/black side: reroll only at 6000) are confirmed from the physical pieces; don't present unverified data as official.
- Modules pulled forward from Turbulence: `altitude-5000` (BUD red; the `altitudes` hook drops the 6000 space in `createGame`) and `wind-reversed` (NZIR red and black; the airplane starts on the opposite ring space, `WIND_REVERSED_START`; `WindRing` draws that space at the top); `engines-out` (TER yellow and black: Engine spaces covered and the Engines panel hidden, 3 of 4 dice per player, glide one space at the end of every round but the final one, landing without a speed check, `waivedLanding`).
- Phase 8 (done Oct 4, 2026; all rule questions settled with the user): altitude tracks A–D (`ALTITUDE_TRACKS`; Turbulence and Bad Visibility on `AltitudeSpace`, applied by the core rules after each of a player's own dice, with `setAside` counts), `alarms` (Alarm board in `GameState.alarms`, six alarm token slots, `checkAnySlot` blocks the Action), `total-trust` (`autoRoll`: the server rolls after the `NEXT_TURN_MS` pause), `belly-landing` (WAW). Scenario data fields: `altitudeTrack`, `alarms`, `totalTrust` (per approach space); an `alarms` or `totalTrust` array switches its module on (`entryModules`), and `Entry.modules` rejects those two ids. Repeated airport + colour ids are numbered (`dus-red1`, `dus-red2`). Open rule assumptions are listed in `docs/phases/phase-08-turbulence.md`.
- Phase 9 (done): i18n, English + Vietnamese (glossary and `vi.json` reviewed by the user). Phase 10: local game history (Flight Log). Phase 11: persistence (store behind an interface). Phase 12: deploy (public or private). Phases are numbered in execution order (renumbered Oct 4, 2026).
- Later (M6–M7, Phases 13–21): a multi-game platform, designed in `docs/proposals/multi-game-platform.md` (engine contract, everything as moves, generic protocol, match log, client shell + router, accounts, a second game, scale-out, large games). Until Phase 13 starts, the architecture rules above stay as they are.
- Exact rule numbers must be checked against the rulebooks; the numbers in the plan are a starting model. Ask the user when a rule is unclear instead of guessing.

## Workflow

When a phase is done (its "Done when" check verified, plus `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm build` passing):

- Tick that phase's checklist in its `docs/phases/phase-NN-*.md` file. Leave unfinished items unticked and say why. Add a "✅ Verified <date>" note to its "Done when" line, and update the phase's status in the `docs/PLAN.md` table.
- Update the docs so they match the code: the relevant `docs/reference/` files (protocol, game rules and assumptions, UI, testing, deployment), later phase files affected by work pulled forward, and this file (stack, commands, rules) when they changed.

## Commands

- `pnpm dev` — server (port 3000, `tsx watch`) + Vite together; Vite proxies `/socket.io` and `/health` to the server
- `pnpm dev:lan` — like `pnpm dev`, but Vite listens on the LAN (`--host`) so a phone can open the Network URL it prints
- `pnpm build` — production build of every package (`pnpm -r build`: shared `tsc`, server `tsup`, client `tsc -b && vite build`)
- `pnpm start` — run the built server (`packages/server/dist/index.js`), which also serves the built client; set `NODE_ENV=production` for anything shared
- `pnpm test` — Vitest, all packages; `pnpm test:watch` to re-run on change
- `pnpm e2e` — Playwright: builds, starts the production server on port 3100 (`GAME_SEED=1`, `E2E_HOOKS=1`) and runs `e2e/` on Desktop Chrome, iPhone 13 (WebKit), Pixel 7; `pnpm exec playwright test -g "<name>" --project "Desktop Chrome"` for one test
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` — same checks as CI; `pnpm format` fixes formatting
- `pnpm lighthouse` — mobile Lighthouse audit of the build (Lighthouse CI; runs in CI on Linux, fails on Windows cleanup)
- `pnpm --filter @sky/shared random-play [games] [firstSeed] [scenario id | all]` — play random games (YUL by default) and print how they ended
- `pnpm --filter @sky/client preview` — serve the built client alone with Vite (no game server)
- `pnpm exec playwright install chromium` — one-time browser download for Playwright
- Cloudflare tunnel by hand (two PowerShell terminals; details in `docs/reference/sharing-and-deployment.md`):
  - Terminal 1: `pnpm build; $env:NODE_ENV = 'production'; $env:TRUST_PROXY = '1'; pnpm start` — wait for `server listening on http://localhost:3000`
  - Terminal 2: `cloudflared tunnel --url http://localhost:3000` (or `& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000`) — the `https://*.trycloudflare.com` line is the link; Ctrl+C in both to stop

## Shortcuts

- **"run tunnel"**: share the current build on a public link (manual steps for the user: `docs/reference/sharing-and-deployment.md`).
  1. Check port 3000 is free; if something is listening there, say what and ask before touching it.
  2. `pnpm build`.
  3. In the background: `NODE_ENV=production TRUST_PROXY=1 PORT=3000 node packages/server/dist/index.js`; wait until `http://localhost:3000/health` answers.
  4. In the background: `"C:/Program Files (x86)/cloudflared/cloudflared.exe" tunnel --no-autoupdate --url http://localhost:3000`; read the `https://*.trycloudflare.com` URL from its output.
  5. Check `<url>/health` and `<url>/` answer through the tunnel, then give the user the link and remind them to create the game from that link (not localhost). Never set `GAME_SEED` or `E2E_HOOKS` for a tunnel.
- **"stop sharing"**: stop both background tasks, then make sure nothing is left on Windows: kill whatever listens on port 3000 (with its process tree, `taskkill /T /F`) and any `cloudflared` process; confirm port 3000 is free and no `cloudflared` runs.
