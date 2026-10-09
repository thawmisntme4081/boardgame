# Sky Team 11: Game history (local)

[← Sky Team epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ✅ Done** · Effort: **low**

## Goals

- Players see their past games and which scenarios they have landed (the Flight Log "victory" checkboxes), on their own device, with no accounts.
- Accounts and cross-device history come later, on the multi-game platform: [Platform 06](../platform/phase-06-accounts.md).

## Flight Log screen (target design)

A "Flight Log" dialog modeled on the reference screenshot the user shared: one row per scenario, in Flight Log order (green, yellow, red, black), with columns:

| Column | Content |
| --- | --- |
| Color | Badge in the scenario color (no box label) |
| Code | Airport code in split-flap tiles (one dark tile per letter) |
| Scenario | Airport name (`AIRPORT_NAMES`) |
| Pilot (W/L) | Your wins / losses on this scenario when you flew as the pilot |
| Co-pilot (W/L) | Your wins / losses on this scenario when you flew as the co-pilot |

A W/L cell is green when it has at least one win, orange when it only has losses, empty when the scenario was never played. The list scrolls inside the dialog; the header row stays visible. Opened from the lobby (and the game-over dialog).

## Feature scope

- **In:** finished games and scenario victories saved in the browser; a ✓ on landed scenarios in the picker; the Flight Log dialog; a small history list. No server changes.
- **Out:** accounts and server-side history ([Platform 06](../platform/phase-06-accounts.md)); public leaderboards; replays.

## Technical tasks

1. On game over, the client saves `{ scenario, abilities, partner name, result, end reason, rounds, date }` in `localStorage` (wrapped in try/catch; works without it). Keep the record format simple and versioned: Platform 06 imports it into an account.
2. Scenario picker shows ✓ on scenarios won on this device.
3. Flight Log dialog (design above), computed from the saved games: your W/L per scenario, split by seat (pilot, co-pilot). No team column.
4. "History" list of past games (a tab in the same dialog).

## Checklist

- [x] History saved on game over (local)
- [x] ✓ on landed scenarios in the picker
- [x] Flight Log dialog (color badge, split-flap code, name, pilot and co-pilot W/L, green/orange cells)
- [x] History list in the lobby (a tab of the Flight Log dialog, also opened from the game-over dialog)
- [x] Tests (component + one Playwright game ending in a recorded result)

**Done when:** a finished game appears in the history list and the scenario shows ✓ after a reload. ✅ Verified (`e2e/history.spec.ts` on three devices: recorded once, kept after a reload, ✓ in the picker; 351 unit tests, 41 Playwright tests).

## How it works

- `lib/history.ts`: `GameRecord` (format `v: 1`), `loadHistory` / `saveRecord` (`localStorage` key `sky-team:history`, newest first, at most 500 games, storage errors ignored), `recordFor` (a record only when a view changes from playing to over, so repeated views, reconnects and reloads on the result screen never count twice), `scenarioStats`, `landedScenarios`.
- `api.ts` records on `game:view`; the store keeps `history` so the picker and the dialog update at once.
- `components/FlightLog.tsx`: the dialog (shadcn Tabs: Flight Log table, History list), opened from the lobby and the game-over dialog.

## Open questions (all settled)

1. ~~Vietnamese terms~~ Settled with the user: Vietnamese "Flight Log" = "Nhật ký bay", History = "Lịch sử", W/L = "T/B" (thắng/bại). New terms for the glossary in [Sky Team 10](phase-10-i18n.md).
2. ~~Which device records a game~~ Settled with the user: a game counts only for the device that saw it end; a game whose end arrived while the page was closed or reloading is not recorded.
