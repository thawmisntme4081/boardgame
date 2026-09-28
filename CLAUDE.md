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
- No in-game chat (removed at the user's request): players talk outside the app in the strategy phase and press "Ready to roll"; do not add chat back unless asked.
- Game state is in memory for v1: run a single server instance.

## UI rules

- Mobile-first. Custom Tailwind breakpoints in `@theme`: `tablet` = 600px, `desktop` = 1024px.
- Phone portrait: status bar, tracks strip, scrolling cockpit, dice tray fixed at bottom. Tablet: two columns (tracks + cockpit / dice tray). Desktop: one centred container (max 72rem): tracks side by side above the cockpit, dice tray below; not full width. Desktop cockpit: equal side columns (16%): pilot radio + landing gear on the left (switch right of slot), co-pilot radio + flaps on the right (switch left of slot); axis, engines, brakes, concentration in the centre. Below desktop, radio is still two panels (pilot, co-pilot). Gear, flaps and brakes show a toggle `Switch` (svgs/Switch.tsx), not a light.
- Tap a die, then tap a slot (no required drag-and-drop). Touch targets >= 44px. Use `100dvh` and safe-area insets. No hover-only info.
- On `visibilitychange` to visible: reconnect and `room:rejoin` with the saved token.

## Scope

- v1: base game, one airport, responsive UI, reconnection, public deploy.
- Phase 8: remaining base-box airports/modules via a module hook system.
- Phase 9: Turbulence expansion (Turbulence, Low Visibility, Alarms modules, 20 scenarios).
- Exact rule numbers must be checked against the rulebooks; the numbers in the plan are a starting model. Ask the user when a rule is unclear instead of guessing.

## Workflow

When a phase is done (its "Done when" check verified, plus `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm build` passing):

- Tick that phase's checklist in `docs/PLAN.md`. Leave unfinished items unticked and say why. Add a "✅ Verified <date>" note to its "Done when" line.
- Update the docs so they match the code: the relevant `docs/PLAN.md` sections (protocol table, game state and rules, assumptions, later phases affected by work pulled forward) and this file (stack, commands, rules) when they changed.

## Commands

- `pnpm dev` — server + Vite together
- `pnpm test` — Vitest
- `pnpm e2e` — Playwright
- `pnpm -r build` — production build
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` — same checks as CI
- `pnpm --filter @sky/shared random-play [games] [firstSeed]` — play random games and print how they ended
- `pnpm --filter @sky/client dev --host` (+ `pnpm --filter @sky/server dev`) — open the game from a phone on the LAN
- `pnpm exec playwright install chromium` — one-time browser download for Playwright
