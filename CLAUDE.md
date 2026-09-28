# Sky Team Online

Online 2-player, cooperative web version of the board game Sky Team (pilot + co-pilot land a plane by placing dice silently). Personal/learning project. Full plan: `docs/PLAN.md` — follow its phases in order.

## Stack (decided)

- TypeScript strict everywhere, pnpm workspaces monorepo: `packages/shared`, `packages/server`, `packages/client`
- Server: Node 20+, Express, Socket.IO, Zod for every incoming payload
- Client: React + Vite, Tailwind CSS v4 (`@tailwindcss/vite`), Zustand for the latest server view
- shadcn/ui ONLY for lobby, dialogs, drawer (phone bottom sheet), toasts, tooltip/popover, select/tabs. Add components one at a time with `pnpm dlx shadcn@latest add <name>` in `packages/client`. The cockpit board, dice, tracks and alarm board are custom components (Tailwind + SVG).
- Tests: Vitest (+ fast-check fuzzing), socket.io-client integration tests, React Testing Library, Playwright E2E incl. iPhone/Pixel device profiles
- Deploy: one Docker image, one Node process serving the built client + Socket.IO on the same port. Render free tier for testing; Railway Hobby or small Fly.io machine later.

## Architecture rules (do not break)

- The server is the referee. Clients send intents only (`game:place { dieId, slot, coffeeDelta }`); the server validates with the shared rules and broadcasts.
- All game rules live as pure functions in `packages/shared` (`createGame`, `rollDice`, `canPlaceDie`, `placeDie`, `resolveRound`, `checkLanding`). No rules in React components or socket handlers.
- `viewFor(state, seat)` is the ONLY way state leaves the server. A player never receives the partner's unplaced dice values, the RNG seed, or future rolls.
- Seedable RNG; tests use fixed seeds. Log every accepted move for replay.
- Chat is allowed only in the strategy phase between rounds; locked once dice are rolled (the game's no-talking rule).
- Game state is in memory for v1: run a single server instance.

## UI rules

- Mobile-first. Custom Tailwind breakpoints in `@theme`: `tablet` = 600px, `desktop` = 1024px.
- Phone portrait: status bar, tracks strip, scrolling cockpit, dice tray fixed at bottom, chat in a bottom sheet. Desktop: three columns (tracks / cockpit / chat + log), dice tray under the board.
- Tap a die, then tap a slot (no required drag-and-drop). Touch targets >= 44px. Use `100dvh` and safe-area insets. No hover-only info.
- On `visibilitychange` to visible: reconnect and `room:rejoin` with the saved token.

## Scope

- v1: base game, one airport, responsive UI, reconnection, public deploy.
- Phase 8: remaining base-box airports/modules via a module hook system.
- Phase 9: Turbulence expansion (Turbulence, Low Visibility, Alarms modules, 20 scenarios).
- Exact rule numbers must be checked against the rulebooks; the numbers in the plan are a starting model. Ask the user when a rule is unclear instead of guessing.

## Commands

- `pnpm dev` — server + Vite together
- `pnpm test` — Vitest
- `pnpm e2e` — Playwright
- `pnpm -r build` — production build
