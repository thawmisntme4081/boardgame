# Platform 06: Accounts (the Flight Log goes with you)

[← Platform epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **high**

Was stage B of the old game-history phase (now [Sky Team 11](../sky-team/phase-11-history.md) covers local history). Needs [Platform 04](phase-04-match-log.md)'s match store and the domain from [Sky Team 13](../sky-team/phase-13-deploy.md) (cookies, HTTPS).

## Goals

- Optional accounts, so a player's Flight Log and their seat follow them across devices; guests keep playing without one.
- **Decided Oct 6, 2026:** the history a player keeps is the Flight Log (one small record per game: scenario, seat, result, round, date), stored in the account, not the server's match log. Sky Team's matches are deleted 30 days after they end (`keepEnded` in the registry), so history cannot be read from `matches`.

## Feature scope

- **In:** sign-in, sessions for HTTP and sockets, seats linked to accounts, the Flight Log stored per account (written by the server when a match ends, for every seated account), a history page reading it, a profile (display name), import of the device's Sky Team 11 history on first sign-in, account deletion.
- **Out (decided Oct 6, 2026):** history read from the match store, and the replay viewer (old matches are deleted).
- **Out:** public leaderboards; social features (friends lists, chat).

## Technical tasks

0. First (decided Oct 7, 2026): switch the shell to TanStack Router's file-based routes, before adding the new pages. Add `@tanstack/router-plugin` to `packages/web/vite.config.ts`; move the routes of `packages/web/src/router.tsx` to `src/routes/` (`__root.tsx`, `index.tsx`, `play.$gameId.tsx`, `r.$code.tsx`), keeping the redirect of a seated player to their room (`beforeLoad`) and the not-found redirect to `/`; build the router (and the tests' `renderAt`) from the generated `routeTree.gen.ts`, committed and left out of Prettier and ESLint; shell tests and E2E green before going on.
1. Sign-in via an auth library storing users in the platform's SQLite database (e.g. Better Auth): Google or GitHub, or email one-time codes if an email service is added. No passwords stored.
2. Sessions in an httpOnly cookie, read by Express and the Socket.IO handshake; seats linked to accounts; guests unaffected.
3. Flight Log records per account: when a match ends, the server writes one record per seated account (game, scenario, seat, outcome, round, date) into a `flight_log` table; the history page reads it; per-game summary cards from each game's `Summary` component. Guests keep the local Flight Log (Sky Team 11).
4. Profile (display name); import of the local history from Sky Team 11 on first sign-in.
5. Account hygiene: sign out, delete account and history, sign-in rate limits, no session ids in logs.

## Checklist

- [ ] File-based routes (`src/routes/`), behaviour unchanged
- [ ] Sign-in provider set up (OAuth app credentials from the user)
- [ ] Sessions for HTTP and sockets; seats linked to accounts; guests unaffected
- [ ] Flight Log per account (written at match end), history and profile pages
- [ ] Local-history import, sign out, delete account
- [ ] Tests (mocked auth in unit/integration, one Playwright sign-in flow against a test provider)

**Done when:** the same history appears after signing in on another device.
