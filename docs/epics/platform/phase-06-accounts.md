# Platform 06: Accounts (the Flight Log goes with you)

[← Platform epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: 🚧 In progress (A–D done)** · Effort: **high** (8 stages, each small to medium)

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
- [x] Tables `users`, `auth_accounts` (provider links), `auth_sessions` added as new `MIGRATIONS` steps (step 3, with `auth_verifications` for Better Auth verification state; snake_case columns mapped in `accounts.ts`; a test checks Better Auth finds nothing missing)
- [x] Sign-in with Google (OAuth). Google: tested end to end with the token endpoint mocked; trying it with a real Google client needs `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (redirect URL `http://localhost:5173/api/auth/callback/google`)
- [x] Endpoints: sign in, callback, sign out (Better Auth under `/api/auth/*`), `GET /auth/me` (the signed-in user or `null`); behind the site password when it is on
- [x] Session cookie: httpOnly, `SameSite=Lax`, `Secure` in production, apart from the site-password cookie (`platform.session_token`, `__Secure-` prefixed in production; 30 days)
- [x] Sign-in rate limit per address (10 sign-in requests a minute, from the server's own reading of the address, never a client header); no session id or token in logs (Better Auth's messages only, a test checks)
- [x] Server tests with the provider mocked (`accounts.test.ts`)

**Done when:** in dev, signing in sets a session and `GET /auth/me` returns the user; signing out clears it. ✅ Verified Oct 7, 2026 (Google OAuth flow mocked in tests: `/auth/me` is `null`, then the user, then `null` after sign-out; Google account tests with the token endpoint mocked; all 440 unit tests, typecheck, lint, format and build pass.).

### C. Sign-in in the shell · small

- [x] `account` state in the platform store, loaded from `/auth/me` at start (after the site password): `'loading'`, `'off'` (no accounts on the server: no sign-in shown), or the sign-in methods (`GET /auth/methods`) and the user; `src/account.ts`
- [x] "Sign in" on the game picker and the game page; signed in: the name and a menu (sign out). The sign-in dialog offers Google when configured; `screens/Account.tsx`, shown by `CardTop`'s `account` option
- [x] Signed in: the lobby's name field shows the account's name, not editable (also on an invite link); if Google provides no name, the player chooses it once (a dialog that cannot be skipped, only signed out of; `POST /auth/name` refuses a second name, Better Auth's own `/update-user` is off; Google names are cut to 20 characters to fit a room)
- [x] Texts in the `platform` namespace (en, vi, fr): `account.*`
- [x] Shell tests (signed out, signed in, sign out): `screens/Account.test.tsx` against a fake accounts server; 4 more server tests for the name and the methods

**Done when:** a player can sign in and out from the site; guests see no difference except the button. ✅ Verified Oct 7, 2026 (in `pnpm dev` on an iPhone 13 profile: sign in with Google, still signed in after a reload, sign out from the game page; with no accounts on the server the button is gone; 6 shell tests and 13 accounts tests pass, plus all web and server tests, typecheck, lint, format and build).

### D. Seats follow the account · medium

- [x] The Socket.IO handshake reads the session cookie: the socket knows its user (or none) (`io.use` in `app.ts`, `socket.data.userId`; the client reconnects after signing in or out, so the server sees the change)
- [x] `match_seats` and the room's players carry the `userId` of a signed-in player (`MIGRATIONS` step 4: `match_seats.user_id`; `Player.userId`, set on create and join, and on a guest's rejoin once that player signed in)
- [x] Rejoin by account: opening the site on another device, signed in, takes the player back to their seat (no token needed): `room:resume` (the account's seat in its most recently active room, with a new rejoin token; the client sends it when signed in without a saved seat)
- [x] One account cannot hold both seats of a room (joining your own room's code gives your seat back); guests keep rejoin tokens exactly as now
- [x] Integration tests: two devices, one account; a guest next to a signed-in player (`seats.test.ts`, 7 tests, incl. a guest who signs in later and a restart)
- [x] `ROOM_FORMAT` bumped if the saved room changes: not needed, `userId` is an optional field that older rows simply lack (they load as guests)

**Done when:** a game started on a laptop continues on a phone after signing in there. ✅ Verified Oct 7, 2026 (in `pnpm dev` with three browsers: Ana signs in on a laptop and creates a game, Ben joins as a guest, Ana signs in on a Pixel 7 profile and lands in the game as the pilot, still there after a reload; 7 seat tests, all web, server and protocol tests, typecheck, lint, format and build pass). Known: the device the seat moved away from keeps showing the last board until it is used again or comes back to the front; then it takes the seat back the same way (the seat follows the device last used).

### E. The Flight Log per account · medium

- [x] Table `flight_log` (user, game, scenario, seat, partner's name, abilities, result, end reason, round, date), a `MIGRATIONS` step
- [x] Written by the server when a match ends (`over`), one row per seated account, once (not again after a restart)
- [x] `GET /api/flight-log` (the signed-in user's rows, newest first)
- [x] Sky Team's Flight Log dialog reads it when signed in, the device's `localStorage` when not; the ✓ on landed scenarios from the same source
- [x] A game's history view in the contract (`GameClientModule.History`, instead of a `Summary` card)
- [x] Tests: written once per account, readable only by its owner

**Done when:** a game finished on one device shows in the Flight Log on another, signed in to the same account. ✅ Verified Oct 7, 2026 (server: 3 tests in `flightlog.test.ts` — one row per signed-in player and match, once also after a restart, readable only by its owner over HTTP; client: the store reads the server when signed in and keeps nothing on the device then).

### F. Import the device's history · small

- [x] On first sign-in on a device, its local Flight Log is imported at once (no question asked)
- [x] Duplicates skipped (same game, time and seat)
- [x] The local copy cleared afterwards
- [x] Tests: import once, no duplicates on a second device

**Done when:** a player's old games on a device appear in their account after signing in. ✅ Verified Oct 7, 2026 (server import test: valid games added, junk skipped, a second device adds nothing twice; client tests: sent once and the device copy cleared only on success).

### G. Profile and history pages · small

- [x] `/u/me` (or `/history`): the account's Flight Log, all games, newest first
- [x] Texts in en, vi, fr

**Done when:** a signed-in player sees their whole history on one page. ✅ Verified Oct 7, 2026 (`/history` page tests signed in and signed out; the game's `History` component in the module contract replaces the planned `Summary` card).

### H. Account deletion and going live · small

- [x] Delete account: the user, their sessions, provider links and Flight Log rows; their seats become guests
- [ ] Sign-in set up for the live site (the owner's steps are in the deployment doc, group 6b; not done yet): Google OAuth credentials with the redirect URL on `https://boardgames-dom-mam.fly.dev`, the email service's key; Fly secrets set by the owner
- [x] Deployment doc: the provider set-up, the new secrets
- [x] One Playwright sign-in flow against a test provider
- [x] `CLAUDE.md`, architecture and protocol docs updated

**Done when:** the same history appears after signing in on another device, on the live site.

## Decisions (Oct 7, 2026)

- Sign-in methods: Google, and an email one-time code.
- Domain: `boardgames-dom-mam.fly.dev` (no custom domain); Google's redirect URL points there.
- Importing a device's history: at once, without asking.
- Display name: the one from the sign-in, not editable. If Google provides no name, it is asked once at the first sign-in and then fixed. Signed in, the lobby's name field shows it and cannot be changed (guests still type theirs).
- The site password stays in front of everything: friends enter it once, then may sign in; accounts only add the history and seats that follow them. Guests play as now.
- After the import, the device's local Flight Log is cleared (the account holds it).

## Open questions

None open.

## Checklist

- [x] A. File-based routes
- [x] B. Accounts on the server
- [x] C. Sign-in in the shell
- [x] D. Seats follow the account
- [x] E. The Flight Log per account
- [x] F. Import the device's history
- [x] G. Profile and history pages
- [ ] H. Account deletion and going live

**Done when:** the same history appears after signing in on another device.
