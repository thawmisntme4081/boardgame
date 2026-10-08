# Sky Team 05: React client

[← Sky Team epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ✅ Done**

## Goals

- A mobile-first client that plays the base game on phone, tablet and desktop.
- The client never decides a rule: it renders the view and highlights moves with the same shared check as the server.

## Feature scope

- **In:** typed socket + Zustand store, responsive layout shell, lobby and waiting room, the full cockpit board, dice tray, coffee, reroll flow, reconnect on tab return, game-over dialog with rematch.
- **Out:** drag-and-drop (not wanted), chat (removed).

## Technical tasks

1. Typed socket singleton; Zustand store with the latest `PlayerView` plus UI-only state (selected die, draft coffee, reroll picks).
2. CSS Grid layout shell (`.game-grid`) with `tablet`/`desktop` variants.
3. Lobby: create, join by code, invite link `/r/ABCD`, Web Share; waiting room.
4. SVG board (axis, speed gauge, tracks) and 48 px slot buttons.
5. Valid slots highlighted with `canPlaceInView` (same `checkPlacement` as the server); radio target shown on the approach track.
6. Game-over dialog (every failed landing condition) and rematch; reroll flow.

## Checklist

- [x] Typed socket singleton + Zustand store holding the latest `PlayerView` (plus UI-only state)
- [x] Mobile-first layout shell: CSS Grid areas for phone, tablet and desktop
- [x] Lobby screen: create game, join by code, copy invite link (`/r/ABCD`), Web Share on phones; waiting room with the code
- [x] Board: axis, engines, radio, gear, flaps, brakes, concentration, altitude and approach tracks (SVG with a `viewBox`; slots are 48 px buttons)
- [x] Dice tray: tap a die, then tap a slot; valid slots highlighted via the shared rules; the radio target shows on the approach track
- [x] Coffee ± control, turn indicator, round and altitude display, all with 44 px touch targets
- [x] ~~Strategy-phase chat panel~~ Built, then removed (no in-game chat)
- [x] Reconnect on `visibilitychange` when a phone brings the tab back (also on reload, from the saved session)
- [x] Game over screen with reason (every failed landing condition) and rematch
- [x] Reroll flow: spend a token, tick dice, reroll or keep all

**Done when:** two people on your LAN, one on a desktop and one on a phone in portrait, can finish the base scenario. ✅ Verified (desktop Chromium + emulated iPhone 13 through lobby → game → rematch, also over the LAN address and a Cloudflare tunnel).

## Notes

`canPlaceDie` was split so the client runs the same check (`checkPlacement` takes a `PlacementContext`, which both `GameState` and `PlayerView` provide; a test compares both on 100,000+ moves). The game screen is lazy-loaded.
