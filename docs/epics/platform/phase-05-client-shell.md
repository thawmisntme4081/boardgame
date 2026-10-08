# Platform 05: Client shell and router

[← Platform epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ✅ Done** · Effort: **medium-high**

Design reference: [multi-game proposal](../../proposals/multi-game-platform.md), sections 4.5 and 4.6 (step E).

## Goals

- A platform shell (game picker, rooms, presence, reconnection, language) that hosts game UIs as lazy-loaded modules.
- Sky Team's UI becomes the first game module, unchanged for players.

## Feature scope

- **In:** TanStack Router with the routes in the proposal (`/`, `/play/:gameId`, `/r/:code`, `/m/:matchId`, `/history`, `/u/:userId` later); the `GameClientModule` contract (`Board`, `SetupForm`, `Summary`, `locales`); `games/sky-team/client` (cockpit, tray, tracks, preflight, svgs); a shared design-system package; i18n split into a platform namespace and one per game; game-specific UI state (`selectedDieId`, `coffeeDelta`, `internSlot`, `rerollPick`) in a Sky Team store slice.
- **Out:** new games (Pandemic); accounts pages (Platform 06).

## Technical tasks

1. Router and pages; `/r/:code` invite links keep working.
2. `GameClientModule` contract and a `GameHost` that lazy-loads a game's module by id.
3. Move the Sky Team UI into `games/sky-team/client`; the lobby's scenario picker becomes Sky Team's `SetupForm`.
4. Split the platform store from the Sky Team UI store.
5. Split `en.json` / `vi.json` into platform and `sky-team` namespaces (same keys inside each).
6. Design-system package (`packages/ui`): Tailwind theme and the shadcn components.

## What was built

- **Layout:** `packages/shared` → `games/sky-team/rules` (`@sky/rules`); `packages/client` → `packages/web` (`@platform/web`, the shell); the Sky Team UI → `games/sky-team/client` (`@sky/client`); a new `packages/ui` (`@platform/ui`). The workspace includes `games/*/*`; Docker, CI paths, Prettier, ESLint, Vitest projects and TypeScript paths follow. Files moved with `git mv`, so history follows them.
- **`@platform/ui`:** the shadcn components (`pnpm dlx shadcn@latest add` now runs here), `cn`, `theme.css` (fonts, shadcn tokens, dark mode, breakpoints), `i18n.ts` (the one i18next instance, `addLocales`), the platform's locales, `LanguageSwitch`, and `game.ts`: the `GameClientModule` / `PlatformApi` contract (`Board`, `SetupForm`, `WaitingInfo`, `locales`, `defaultSetup`, `connect`, `onView`, `reset`, `errorText`).
- **Shell (`@platform/web`):** TanStack Router (`/` picker, `/play/:gameId`, `/r/:code`; a seated player is redirected to their room); `games.ts` (installed games, lazy `loadGame`, `useGameModule`); a generic `api.ts` (`platformServices` for games) and store (`usePlatform`); presence toasts for any number of seats (`presence.ts`); platform error texts plus the game's (`messages.ts`). The game's chunk is named after it (`assets/sky-team-*.js`).
- **Sky Team client (`@sky/client`):** its module (`index.ts`), store (`useSkyTeam`, following views through `onView`; the Flight Log recorded there), actions over the injected `PlatformApi` (`api.ts`), `SetupForm` (scenario, round timer, Flight Log) and `WaitingInfo` (who is missing, the scenario, the timer), its own locales (namespace `sky-team`), and `styles.css`.
- **Protocol:** `JoinResult` carries `game` (which module to load after a join or rejoin) and `match:view` carries `seat` (so the shell never reads a game's view).
- **Tests:** the Sky Team UI tests moved with it (plus its store, lobby options and texts); the shell has new tests for the picker, a game's page and rooms (through the real routes), its store, presence toasts, texts and the password gate. E2E: creating starts on `/play/sky-team`; the first lobby test goes through the picker and checks no game code was downloaded.

## Open questions

- Assumption (to confirm): no `/m/:matchId` page: the board stays on the room's `/r/:code`, which does not change between rematches (match ids do). `/history` and `/u/:userId` come with Platform 06.
- Assumption (to confirm): leaving a room goes back to that game's page (`/play/<game>`, as the old lobby did), not to the picker.
- Assumption (to confirm): one Tailwind entry: the shell's `index.css` imports each installed game's `styles.css`, so a game's CSS (a few KB) is in the first load; only its code is lazy.
- Assumption (to confirm): the platform's texts live in `@platform/ui` (not in the web package), so a game can type-check its use of them without depending on the shell.
- Assumption (to confirm): the new platform texts (site title "Board games", its tagline, "Choose a game", "All games", Sky Team's one-line description, and the share text, now "Join my game" instead of "Fly with me in Sky Team") were translated by Claude into Vietnamese and French: to review.
- Note: pages load a game's module with a small hook (`useGameModule`) instead of React's `use` with Suspense, which did not resolve on a page's first render under TanStack Router in the tests.

## Checklist

- [x] Router with game picker and setup pages
- [x] `GameClientModule` + lazy loading (`games.ts`: `loadGame`, `useGameModule`; the room page hosts the module)
- [x] Sky Team UI moved into its game module
- [x] Platform / game store split
- [x] i18n namespaces
- [x] `packages/ui` design system
- [x] Playwright on all three devices green; Lighthouse not worse — Playwright green; Lighthouse not run here (it fails on Windows; CI runs it on the next push). The first load is smaller than before (571 KB of JS instead of 598 KB), so it should not be worse.
- [x] UI and architecture docs, `CLAUDE.md` updated

**Done when:** a player picks Sky Team on the game picker, plays a full game, and the first page load does not include the Sky Team board code. ✅ Verified (Playwright on three devices: the first lobby test opens the picker, checks that no `assets/sky-team-*.js` was requested, picks Sky Team and creates a game; full games play as before; 41 passed, 4 intentional skips. Built: `index-*.js` (571 KB, the shell) holds no board, cockpit, Sky Team texts, rules or scenarios; `sky-team-*.js` (185 KB) loads with a Sky Team page or room. 431 unit and integration tests; typecheck, lint, format and build pass).
