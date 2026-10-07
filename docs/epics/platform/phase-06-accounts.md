# Platform 06: Accounts (the Flight Log goes with you)

[← Platform epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: 🚧 In progress (A, B done)** · Effort: **high** (8 stages, each small to medium)

Was stage B of the old game-history phase (now [Sky Team 11](../sky-team/phase-11-history.md) covers local history). Needs [Platform 04](phase-04-match-log.md)'s match store and the deployed site from [Sky Team 13](../sky-team/phase-13-deploy.md) (cookies, HTTPS).

## Goals

- Optional accounts, so a player's Flight Log and their seat follow them across devices; guests keep playing without one.
- **Decided Oct 6, 2026:** the history a player keeps is the Flight Log (one small record per game: scenario, seat, result, round, date), stored in the account, not the server's match log. Sky Team's matches are deleted 30 days after they end (`keepEnded` in the registry), so history cannot be read from `matches`.

## Feature scope

- **In:** sign-in, sessions for HTTP and sockets, seats linked to accounts, the Flight Log stored per account (written by the server when a match ends, for every seated account), a history page reading it, a profile (display name), import of the device's Sky Team 11 history on first sign-in, account deletion.
- **Out (decided Oct 6, 2026):** history read from the match store, and the replay viewer (old matches are deleted).
- **Out:** public leaderboards; social features (friends lists, chat).

## Stages

Each stage ships on its own: the site keeps working for guests after every one, and the checks (typecheck, lint, format, the affected tests, build) pass before the next starts. The full run (`pnpm test` + `pnpm e2e`) is only at the end of the phase, after stage H.

### A. File-based routes (decided Oct 7, 2026) · small

The shell's routes move to TanStack Router's file-based setup before new pages are added.

- [x] `@tanstack/router-plugin` in `packages/web/vite.config.ts` (before the React plugin)
- [x] `src/routes/__root.tsx`, `index.tsx`, `play.$gameId.tsx`, `r.$code.tsx` from today's `router.tsx`
- [x] The redirect of a seated player to their room (`beforeLoad`) and the not-found redirect to `/` kept
- [x] The router and the tests' `renderAt` built from the generated `routeTree.gen.ts` (committed; left out of Prettier and ESLint)
- [x] Shell tests green, no behavior change

**Done when:** every page and redirect works as before, from the generated route tree. ✅ Verified Oct 7, 2026 (the 25 shell tests, which open every page and redirect through the real routes, pass unchanged; typecheck, lint, format and build pass. E2E waits for the full run after stage H).

### B. Accounts on the server · medium

The user store and the sign-in endpoints, with no page yet.

- [x] Auth library chosen and added (Better Auth 1.7, unless the questions below change it), on the platform's SQLite database: `accounts.ts`, on the connection the match store uses (`openDatabase`; in memory without `DATA_DIR`)
- [x] Tables `users`, `auth_accounts` (provider links), `auth_sessions` added as new `MIGRATIONS` steps (step 3, with `auth_verifications` for the email codes; snake_case columns mapped in `accounts.ts`; a test checks Better Auth finds nothing missing)
- [x] Sign-in with Google (OAuth) and with an email one-time code (sent through an email service, e.g. Resend), both working end to end in dev. Email: checked in `pnpm dev` through Vite (without `RESEND_API_KEY` the code is printed in the server terminal, never in production). Google: tested end to end with the token endpoint mocked; trying it with a real Google client needs `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (redirect URL `http://localhost:5173/api/auth/callback/google`)
- [x] Endpoints: sign in, callback, sign out (Better Auth under `/api/auth/*`), `GET /auth/me` (the signed-in user or `null`); behind the site password when it is on
- [x] Session cookie: httpOnly, `SameSite=Lax`, `Secure` in production, apart from the site-password cookie (`platform.session_token`, `__Secure-` prefixed in production; 30 days)
- [x] Sign-in rate limit per address (10 sign-in requests a minute, from the server's own reading of the address, never a client header); no session id or token in logs (Better Auth's messages only, a test checks)
- [x] Server tests with the provider mocked (`accounts.test.ts`)

**Done when:** in dev, signing in sets a session and `GET /auth/me` returns the user; signing out clears it. ✅ Verified Oct 7, 2026 (email code through `pnpm dev`: `/auth/me` is `null`, then the user, then `null` after sign-out; 9 accounts tests incl. Google with the token endpoint mocked; all 440 unit tests, typecheck, lint, format and build pass. An email sign-in has an empty name until stage C asks for it).

### C. Sign-in in the shell · small

- [ ] `account` state in the platform store, loaded from `/auth/me` at start (after the site password)
- [ ] "Sign in" on the game picker and the game page; signed in: the name and a menu (sign out)
- [ ] Signed in: the lobby's name field shows the account's name, not editable; an email sign-in asks for the name once
- [ ] Texts in the `platform` namespace (en, vi, fr)
- [ ] Shell tests (signed out, signed in, sign out)

**Done when:** a player can sign in and out from the site; guests see no difference except the button.

### D. Seats follow the account · medium

- [ ] The Socket.IO handshake reads the session cookie: the socket knows its user (or none)
- [ ] `match_seats` and the room's players carry the `userId` of a signed-in player
- [ ] Rejoin by account: opening the site on another device, signed in, takes the player back to their seat (no token needed)
- [ ] One account cannot hold both seats of a room; guests keep rejoin tokens exactly as now
- [ ] Integration tests: two devices, one account; a guest next to a signed-in player
- [ ] `ROOM_FORMAT` bumped if the saved room changes

**Done when:** a game started on a laptop continues on a phone after signing in there.

### E. The Flight Log per account · medium

- [ ] Table `flight_log` (user, game, scenario, seat, partner's name, abilities, result, end reason, round, date), a `MIGRATIONS` step
- [ ] Written by the server when a match ends (`over`), one row per seated account, once (not again after a restart)
- [ ] `GET /api/flight-log` (the signed-in user's rows, newest first)
- [ ] Sky Team's Flight Log dialog reads it when signed in, the device's `localStorage` when not; the ✓ on landed scenarios from the same source
- [ ] A game's `Summary` card in the contract (`GameClientModule`) if the history page needs one per game
- [ ] Tests: written once per account, readable only by its owner

**Done when:** a game finished on one device shows in the Flight Log on another, signed in to the same account.

### F. Import the device's history · small

- [ ] On first sign-in on a device, its local Flight Log is imported at once (no question asked)
- [ ] Duplicates skipped (same game, time and seat)
- [ ] The local copy cleared afterwards
- [ ] Tests: import once, no duplicates on a second device

**Done when:** a player's old games on a device appear in their account after signing in.

### G. Profile and history pages · small

- [ ] `/u/me` (or `/history`): the account's Flight Log, all games, newest first
- [ ] Texts in en, vi, fr

**Done when:** a signed-in player sees their whole history on one page.

### H. Account deletion and going live · small

- [ ] Delete account: the user, their sessions, provider links and Flight Log rows; their seats become guests
- [ ] Sign-in set up for the live site: Google OAuth credentials with the redirect URL on `https://boardgames-dom-mam.fly.dev`, the email service's key; Fly secrets set by the owner
- [ ] Deployment doc: the provider set-up, the new secrets
- [ ] One Playwright sign-in flow against a test provider
- [ ] `CLAUDE.md`, architecture and protocol docs updated

**Done when:** the same history appears after signing in on another device, on the live site.

## Decisions (Oct 7, 2026)

- Sign-in methods: Google, and an email one-time code.
- Domain: `boardgames-dom-mam.fly.dev` (no custom domain); Google's redirect URL points there.
- Importing a device's history: at once, without asking.
- Display name: the one from the sign-in, not editable. With an email code there is no name to take, so it is asked once at the first sign-in and then fixed. Signed in, the lobby's name field shows it and cannot be changed (guests still type theirs).
- The site password stays in front of everything: friends enter it once, then may sign in; accounts only add the history and seats that follow them. Guests play as now.
- After the import, the device's local Flight Log is cleared (the account holds it).

## Open questions

None open.

## Checklist

- [x] A. File-based routes
- [x] B. Accounts on the server
- [ ] C. Sign-in in the shell
- [ ] D. Seats follow the account
- [ ] E. The Flight Log per account
- [ ] F. Import the device's history
- [ ] G. Profile and history pages
- [ ] H. Account deletion and going live

**Done when:** the same history appears after signing in on another device.
