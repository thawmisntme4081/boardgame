# Scale-out 02: Many games

[← Scale-out epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started (around the third or fourth game)** · Effort: **medium**

Independent of [Scale-out 01](phase-01-scale-out.md) (that one is about traffic; this one is about the number of games).

## Goals

- Keep the monorepo fast and easy to grow when it holds many games (decided with the user: one repo stays the approach, also at 20 games; a split into several repos only if games get separate owners or release cycles).

**Trigger:** start around the third or fourth game, or earlier if CI gets slow. Until then, `pnpm --filter "...[origin/main]" test` gives affected-only runs without new tools.

## Feature scope

- **In:** Turborepo (task graph, caching, affected-only runs); each game's CSS in its own lazy chunk; a `new-game` generator and games found from a manifest; game art out of git; a crash in one game's rules kept inside its room.
- **Out:** several repositories; publishing the platform packages to a registry; several server instances (that is [Scale-out 01](phase-01-scale-out.md)).

## Why these (what grows with every game)

- **CI time:** CI runs every test on every push; with 20 games a change to one game re-tests all of them.
- **CSS:** the shell's `index.css` imports every game's `styles.css`, so the first page carries every game's styles.
- **Hand-kept lists:** a new game means edits in the server registry (`packages/server/src/games.ts`), the client list (`packages/web/src/games.ts`), `index.css`, the platform texts and the docs.
- **Art in git:** Pandemic alone has about 100 card pictures; many games' art makes the repository slow to clone.
- **The contract:** once many games use the engine and `GameClientModule`, every change to them touches all games: keep the contract small, add optional slots (as `HeaderExtra`), keep the engine test kit as the gate.
- **One process:** a crash in one game's rules (an uncaught exception, not a refused move) can take the server down for every room.

## Technical tasks

1. **Turborepo:** `pnpm add -Dw turbo`; `.turbo/` in `.gitignore`; a `test` script in each package with tests (`vitest run --passWithNoTests`: the rules packages run with Vitest's defaults, the clients with their `vite.config.ts`); `lint` and `format:check` stay at the root.
2. **`turbo.json`:** `build` (`dependsOn: ["^build"]`, `outputs: ["dist/**", "src/routeTree.gen.ts"]`, `env: ["VITE_SENTRY_DSN"]`), `typecheck` and `test` (`dependsOn: ["^build"]`), `dev` (`cache: false`, `persistent: true`); `globalDependencies`: `tsconfig.base.json`, `vitest.config.ts`, `pnpm-lock.yaml` (and any file a test reads outside its package).
3. **Root scripts:** `build`, `typecheck`, `test` through `turbo run`; `test:affected` (`turbo run test typecheck --affected`); keep `vitest run` at the root as `test:all` (watch mode, `--project` runs).
4. **CI:** checkout with `fetch-depth: 0`; pull requests run `turbo run typecheck test build --affected`, pushes to `main` the full run; cache `.turbo` between runs (`actions/cache`), or a remote cache (Vercel's, or self-hosted on the R2 bucket); Playwright stays one job, limited by path filters or `--grep` per game.
5. **Per-game CSS:** each game imports its own `styles.css` from its lazy chunk instead of the shell's `index.css`; check Tailwind still sees each game's classes (`@source`).
6. **`pnpm new-game <id>`:** a generator for `games/<id>/rules` and `games/<id>/client` (definition, view, module, locales, tests, epic folder); the server registry and the client list read a small manifest in each game's folder instead of hand-kept lists.
7. **Game art out of git:** Git LFS, or the art in object storage (the R2 bucket) with the URLs in the build.
8. **Crash isolation:** the room manager catches an exception thrown by a game's `apply` / `view`, refuses that move and logs it (and Sentry), so one game's bug never stops the server.
9. **Docs:** `CLAUDE.md` (commands, the workflow's test commands), `docs/reference/testing.md`, the CI notes.

## Checklist

- [ ] Turborepo runs build, typecheck and test with caching; affected-only runs on pull requests
- [ ] CI time measured before and after
- [ ] Each game's CSS loads with its chunk
- [ ] A new game is created with one command and needs no hand-kept list
- [ ] Game art out of git
- [ ] A throwing game rule refuses the move instead of stopping the server (tested)

**Done when:** adding a game is one command, a pull request touching one game runs only that game's checks, and a full run with nothing changed is replayed from the cache.
