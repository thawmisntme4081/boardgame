# Responsive UI (mobile web)

[← Master plan](../PLAN.md)

Mobile-first: a phone in portrait (360–430 px wide) is the hardest screen, so it is built first and larger screens spread the same components out. The same React components rearrange through CSS Grid areas; only the layout changes, never the game logic. The detailed, always-current UI rules live in `CLAUDE.md` ("UI rules").

```
Phone portrait (< 600 px)        Desktop (>= 1024 px, centred container, max 72rem)
+----------------------+            +--------------------------------------+
| Status bar (sticky)  |            | Status bar (sticky)                  |
+----------------------+            +--------------------------------------+
| Tracks strip         |            |   Altitude track   Approach track    |
+----------------------+            +--------------------------------------+
| Cockpit panels       |            | Cockpit board (named grid areas)     |
| (page scrolls; your  |            |                                      |
|  systems first)      |            +--------------------------------------+
+----------------------+            | Dice tray (sticky)                   |
| Dice tray (sticky)   |            +--------------------------------------+
+----------------------+
```

| Screen | Width | Layout |
| --- | --- | --- |
| Phone portrait | under 600 px | Stacked: sticky status bar, tracks strip, cockpit (ordered per seat), sticky dice tray at the bottom |
| Phone landscape / tablet | 600–1023 px | Two columns: tracks + cockpit left, dice tray right (sticky under the status bar) |
| Desktop | 1024 px and up | One centred container (max 72rem): status bar, both tracks side by side, cockpit board, dice tray. Equal 16% side columns: pilot radio above landing gear on the left, co-pilot radio above flaps on the right; axis (+ wind), engines, brakes and concentration in the centre |

Custom Tailwind breakpoints in `@theme`: `tablet` = 600px, `desktop` = 1024px.

## Layout and styling

- Tailwind CSS v4, with design tokens (colors, spacing, fonts) defined once in `@theme`, so they work as utility classes and as CSS variables for the SVG board.
- shadcn/ui for the lobby (Button, Input, Card, Select), Dialog, toasts, Popover. The cockpit, dice, tracks and module boards are custom.
- CSS Grid with named `grid-template-areas` per breakpoint; container queries for the cockpit so it adapts to its column, not the window.
- Gauges, dice and tracks are SVG with a `viewBox`; slots are real buttons so they stay accessible and easy to tap.
- The page scrolls; the status bar and dice tray are `position: sticky` (no `100dvh`), and `env(safe-area-inset-*)` keeps the tray clear of the iPhone home bar.

## Before take-off

- The lobby picks the scenario and the timer only. In the game's `setup` phase a "Before take-off" panel sits above the tracks (`Preflight`): Pilot and Co-pilot buttons (outline in the seat colour; the creator clicks one, the partner sees them disabled; each player's own seat turns solid once chosen), the six Special Ability cards with their rules when the scenario has any (one each with two cards, the creator's with one), and a Confirm button at the bottom for both. Round 1 (and its traffic die) starts once both have confirmed; until then the dice tray only points to the panel. "Fly again" keeps the scenario picker and returns to the panel, with the last seats and picks kept.

## Turbulence

- Alarms: an Alarm board panel (after Engines in both seats' phone order; its own full row under the control panel on desktop) shows sounding tokens as spaces for the clearing die, named after their Action, then face-down tokens (anonymous), then cleared ones (green check). A blocked space shows a red bell and is never lit.
- Weather: Turbulence (waves) and Bad Visibility (crossed eye) icons on the altitude cards; the dice tray says what this round's weather does and shows Bad Visibility's set-aside dice face down.
- Approach track: a red bell (Alarm) at a card's top left, a muted speaker (Total Trust) at its top right.
- Total Trust: no "Roll dice" button; the tray explains, the status bar says "Total Trust" with a red "No talking" pill once the pause is over.
- Covered spaces (Belly landing's stuck gear) show a grey X.

## Languages

- English and Vietnamese (`i18next` + `react-i18next`). English is the default whatever the browser language. `LanguageSwitch` (lobby card and status bar) changes the language without a reload, saves it in `localStorage` (`sky-team-language`) and sets `<html lang>`. Each player picks their own language.
- Every client string lives in a namespace's `en.json`, `vi.json` and `fr.json`: the platform's in `packages/ui/src/locales`, Sky Team's in `games/sky-team/client/src/locales`; keys are typed from both `en.json` files (`i18next.d.ts`). The server and rules send codes only (`MoveError`, `EndReason`, ids); the client turns them into text (`messages.ts`, `scenarioText.ts`). Numbers use `formatNumber` (`6.000 ft` in Vietnamese).

## Touch interaction

- Tap a die, then tap a slot (no drag-and-drop).
- Touch targets at least 44 × 44 px; dice and slots never smaller.
- Coffee ± appears as large buttons next to the selected die.
- `touch-action: manipulation` to stop double-tap zoom; inputs at 16 px or more so iOS does not zoom on focus.
- No hover-only information: anything shown on hover also shows on tap (popovers). Panel hints sit behind an info icon next to the title (gray; red on the mandatory Axis and Engines).
- Clear turn feedback: the status bar plus `navigator.vibrate` on Android when it becomes your turn.

## Mobile browser behaviour

- Phones pause sockets when the tab is in the background: on `visibilitychange` back to visible, reconnect and send `room:rejoin` with the saved token.
- Optional Screen Wake Lock during a game so the phone does not sleep mid-round.
- Share the room link with the Web Share API (`navigator.share`), falling back to copy-to-clipboard.
- Optional PWA manifest and icon so players can add the game to their home screen.
- Keep the bundle small (the game screen is code-split from the lobby).
