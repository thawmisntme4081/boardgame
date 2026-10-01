# Phase 11: Game history and accounts

[← Master plan](../PLAN.md) · Milestone M4 · **Status: ⏳ Not started** · Effort: **low** (stage A) / **high** (stage B)

## Goals

- Players see their past games and which scenarios they have landed (the Flight Log "victory" checkboxes).
- Optionally, accounts so history follows a player across devices.

## Feature scope

Two stages; stage B only if cross-device history is wanted.

- **Stage A — local history (no accounts):** finished games and scenario victories saved in the browser; a ✓ on landed scenarios in the picker; a small history list. No server changes.
- **Stage B — accounts:** sign-in, server-side history, profile, account deletion. Requires [Phase 9](phase-09-persistence.md) and the deploy domain from [Phase 12](phase-12-deploy.md) (cookies, HTTPS).
- **Out:** public leaderboards; replays (optional add-on, see tasks).

## Technical tasks

**Stage A**

1. On game over, the client saves `{ scenario, abilities, partner name, result, end reason, rounds, date }` in `localStorage` (wrapped in try/catch; works without it).
2. Scenario picker shows ✓ on scenarios won on this device.
3. "History" view (dialog from the lobby) listing past games.

**Stage B**

4. Sign-in with Google (or GitHub) via an auth library (e.g. Better Auth): no passwords stored, no email service needed. Magic links or passwords only if wanted (they need an email service).
5. Sessions in an httpOnly cookie, read by Express and the Socket.IO handshake; seats linked to accounts; guests still play.
6. Server writes one history record per finished game (exactly once, including double "Fly again").
7. Profile (display name); import the device's stage A history on first sign-in.
8. Account hygiene: sign out, delete account and history, sign-in rate limits, no session ids in logs.
9. Optional: replay viewer from the stored seed and move log.

## Checklist

- [ ] Stage A: history saved on game over (local)
- [ ] Stage A: ✓ on landed scenarios in the picker
- [ ] Stage A: history list in the lobby
- [ ] Stage A tests (component + one Playwright game ending in a recorded result)
- [ ] Decision: go ahead with stage B?
- [ ] Stage B: sign-in provider set up (OAuth app credentials from the user)
- [ ] Stage B: sessions for HTTP and sockets; seats linked to accounts; guests unaffected
- [ ] Stage B: server-side history, written exactly once per game
- [ ] Stage B: profile, local-history import, sign out, delete account
- [ ] Stage B tests (mocked auth in unit/integration, one Playwright sign-in flow against a test provider)
- [ ] Optional: replay viewer

**Done when:** (A) a finished game appears in the history list and the scenario shows ✓ after a reload; (B, if built) the same history appears after signing in on another device.
