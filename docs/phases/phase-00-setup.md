# Phase 0: Project setup

[← Master plan](../PLAN.md) · Milestone M1 · **Status: ✅ Done (Sep 28, 2026)**

## Goals

- A monorepo where shared rules, server and client build, lint and test with one command each.
- CI from day one, so every later phase lands on a green pipeline.

## Feature scope

- **In:** pnpm workspace, TypeScript strict, Tailwind v4, shadcn/ui init, ESLint + Prettier, Vitest, CI workflow, GitHub remote.
- **Out:** any game code.

## Technical tasks

1. Create the pnpm workspace with `packages/shared`, `packages/server`, `packages/client`.
2. `tsconfig.base.json` with `strict: true` and the `@sky/shared` path alias.
3. Tailwind CSS v4 via `@tailwindcss/vite`; ESLint + Prettier (with Tailwind class sorting); Vitest at the root.
4. `shadcn` init in `packages/client` (`@/` alias); add components one at a time as needed.
5. Scripts: `dev` (server + Vite via `concurrently`), `build`, `test`, `e2e`.
6. `.github/workflows/ci.yml`: typecheck, lint, format check, test, build.

## Checklist

- [x] Create the pnpm workspace with `shared`, `server`, `client` packages
- [x] `tsconfig.base.json` with `strict: true`, path aliases for `@sky/shared`
- [x] Tailwind CSS v4 in the client via the `@tailwindcss/vite` plugin; ESLint + Prettier (with the Tailwind class-sorting plugin), Vitest at the root
- [x] shadcn/ui init in `packages/client` (`@/` alias), add components only as needed
- [x] Scripts: `dev` (server + Vite together via `concurrently`), `build`, `test`, `e2e`
- [x] Add a CI workflow (`.github/workflows/ci.yml`: typecheck, lint, format check, test, build)
- [x] Push to GitHub (`origin` = `thawmisntme4081/boardgame`)

**Done when:** `pnpm dev` starts both apps and `pnpm test` runs an empty suite. ✅ Verified Sep 28, 2026.

## Notes

pnpm 12 via corepack (esbuild approved in `allowBuilds`); TypeScript pinned to 6.0 because typescript-eslint does not support TS 7 yet; shadcn uses the Radix base with the Nova preset (`cn` package in place of clsx + tailwind-merge); Vite proxies `/health` and `/socket.io` to the server on port 3000.
