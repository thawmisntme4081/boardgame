# Phase 11: Game history and accounts

[← Master plan](../PLAN.md) · Milestone M4 · **Status: ⏳ Not started** · Effort: **low** (stage A) / **high** (stage B)

## Goals

- Players see their past games and which scenarios they have landed (the Flight Log "victory" checkboxes).
- Optionally, accounts so history follows a player across devices.

## Flight Log screen (target design)

A "Flight Log" dialog modelled on the reference screenshot the user shared (Oct 2, 2026): one row per scenario, in Flight Log order (green, yellow, red, black), with columns:

| Column | Content |
| --- | --- |
| Color | Badge in the scenario colour (no box label) |
| Code | Airport code in split-flap tiles (one dark tile per letter) |
| Scenario | Airport name (`AIRPORT_NAMES`) |
| Pilot (W/L) | Your wins / losses on this scenario when you flew as the pilot |
| Co-pilot (W/L) | Your wins / losses on this scenario when you flew as the co-pilot |

A W/L cell is green when it has at least one win, orange when it only has losses, empty when the scenario was never played. The list scrolls inside the dialog; the header row stays visible. Opened from the lobby (and the game-over dialog).

## Feature scope

Two stages; stage B only if cross-device history is wanted.

- **Stage A — local history (no accounts):** finished games and scenario victories saved in the browser; a ✓ on landed scenarios in the picker; a small history list. No server changes.
- **Stage B — accounts:** sign-in, server-side history, profile, account deletion. Requires [Phase 9](phase-09-persistence.md) and the deploy domain from [Phase 12](phase-12-deploy.md) (cookies, HTTPS).
- **Out:** public leaderboards; replays (optional add-on, see tasks).

## Technical tasks

**Stage A**

1. On game over, the client saves `{ scenario, abilities, partner name, result, end reason, rounds, date }` in `localStorage` (wrapped in try/catch; works without it).
2. Scenario picker shows ✓ on scenarios won on this device.
3. Flight Log dialog (design above), computed from the saved games: your W/L per scenario, split by seat (pilot, co-pilot). No team column.
4. "History" list of past games (a tab in the same dialog).

**Stage B**

5. Sign-in with Google (or GitHub) via an auth library (e.g. Better Auth): no passwords stored, no email service needed. Magic links or passwords only if wanted (they need an email service).
6. Sessions in an httpOnly cookie, read by Express and the Socket.IO handshake; seats linked to accounts; guests still play.
7. Server writes one history record per finished game (exactly once, including double "Fly again").
8. Profile (display name); import the device's stage A history on first sign-in.
9. Account hygiene: sign out, delete account and history, sign-in rate limits, no session ids in logs.
10. Optional: replay viewer from the stored seed and move log.

## Checklist

- [ ] Stage A: history saved on game over (local)
- [ ] Stage A: ✓ on landed scenarios in the picker
- [ ] Stage A: Flight Log dialog (colour badge, split-flap code, name, pilot and co-pilot W/L, green/orange cells)
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
