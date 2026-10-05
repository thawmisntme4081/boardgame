# Platform 05: Client shell and router

[← Platform epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **medium-high**

Design reference: [multi-game proposal](../../proposals/multi-game-platform.md), sections 4.5 and 4.6 (step E).

## Goals

- A platform shell (game picker, rooms, presence, reconnection, language) that hosts game UIs as lazy-loaded modules.
- Sky Team's UI becomes the first game module, unchanged for players.

## Feature scope

- **In:** TanStack Router with the routes in the proposal (`/`, `/play/:gameId`, `/r/:code`, `/m/:matchId`, `/history`, `/u/:userId` later); the `GameClientModule` contract (`Board`, `SetupForm`, `Summary`, `locales`); `games/sky-team/client` (cockpit, tray, tracks, preflight, svgs); a shared design-system package; i18n split into a platform namespace and one per game; game-specific UI state (`selectedDieId`, `coffeeDelta`, `internSlot`, `rerollPick`) in a Sky Team store slice.
- **Out:** new games (Second game 01); accounts pages (Platform 06).

## Technical tasks

1. Router and pages; `/r/:code` invite links keep working.
2. `GameClientModule` contract and a `GameHost` that lazy-loads a game's module by id.
3. Move the Sky Team UI into `games/sky-team/client`; the lobby's scenario picker becomes Sky Team's `SetupForm`.
4. Split the platform store from the Sky Team UI store.
5. Split `en.json` / `vi.json` into platform and `sky-team` namespaces (same keys inside each).
6. Design-system package (`packages/ui`): Tailwind theme and the shadcn components.

## Checklist

- [ ] Router with game picker and setup pages
- [ ] `GameClientModule` + `GameHost` (lazy-loaded)
- [ ] Sky Team UI moved into its game module
- [ ] Platform / game store split
- [ ] i18n namespaces
- [ ] `packages/ui` design system
- [ ] Playwright on all three devices green; Lighthouse not worse
- [ ] UI and architecture docs, `CLAUDE.md` updated

**Done when:** a player picks Sky Team on the game picker, plays a full game, and the first page load does not include the Sky Team board code.
