# Phase 18: Accounts and match history

[← Master plan](../PLAN.md) · Milestone M6 · **Status: ⏳ Not started** · Effort: **high**

Was stage B of the old game-history phase (now [Phase 10](phase-10-history.md) covers local history). Needs [Phase 16](phase-16-match-log.md)'s match store and the domain from [Phase 12](phase-12-deploy.md) (cookies, HTTPS).

## Goals

- Optional accounts, so history follows a player across devices and games; guests keep playing without one.
- Match history for every game, read from the match store; Sky Team's Flight Log is one game's view of it.

## Feature scope

- **In:** sign-in, sessions for HTTP and sockets, seats linked to accounts, history and profile pages (`/history`, `/u/:userId`), import of the device's Phase 10 history, account deletion.
- **Out:** public leaderboards; social features (friends lists, chat).

## Technical tasks

1. Sign-in via an auth library storing users in the platform database (e.g. Better Auth): Google or GitHub, or email one-time codes if an email service is added. No passwords stored.
2. Sessions in an httpOnly cookie, read by Express and the Socket.IO handshake; seats linked to accounts; guests unaffected.
3. History from `matches` + `outcome` (written once per match by the match runner); per-game summary cards from each game's `Summary` component.
4. Profile (display name); import of the local history from Phase 10 on first sign-in.
5. Account hygiene: sign out, delete account and history, sign-in rate limits, no session ids in logs.
6. Optional: replay viewer from the stored seed and move log.

## Checklist

- [ ] Sign-in provider set up (OAuth app credentials from the user)
- [ ] Sessions for HTTP and sockets; seats linked to accounts; guests unaffected
- [ ] History and profile pages
- [ ] Local-history import, sign out, delete account
- [ ] Tests (mocked auth in unit/integration, one Playwright sign-in flow against a test provider)
- [ ] Optional: replay viewer

**Done when:** the same history appears after signing in on another device.
