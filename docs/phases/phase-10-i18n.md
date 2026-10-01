# Phase 10: Internationalisation (English + Vietnamese)

[← Master plan](../PLAN.md) · Milestone M4 · **Status: ⏳ Not started** · Effort: **medium** (mostly volume)

## Goals

- Every screen available in English and Vietnamese, switchable without a reload.
- Each player chooses their own language, even within one game.

## Feature scope

- **In:** all client text (lobby, status bar, dice tray, cockpit, dialogs, toasts, error and end-reason messages, module and ability rules, airport and difficulty names), `aria-label`s and SVG titles, number formatting, a language switch.
- **Out:** translating server or rules output — they keep sending codes (`MoveError`, `EndReason`, `ErrorCode`, ids), never sentences.

## Technical tasks

1. **Library:** `i18next` + `react-i18next` (plurals, interpolation, hooks).
2. **Message files:** `packages/client/src/locales/en.json` and `vi.json`, nested keys (`statusBar.yourTurn`, `errors.not-your-turn`, `endReasons.spin`, `modules.kerosene.rule`, …); a `TranslationKey` type from `en.json` so missing or misspelled keys break the build.
3. **Move every string:** `messages.ts`, `scenarioText.ts`, airport/difficulty names (ids stay in `shared`, labels in the client), component text, `aria-label`s, `<title>`s.
4. **Templates, not glued strings:** plurals and values ("Ana is placing a die… (3 dice left)", "rolled 4, a plane 3 spaces ahead"); restructure code-built strings (`slotLabel()`, turn text).
5. **Formatting:** `Intl.NumberFormat(locale)` for altitudes ("6.000 ft"); the clock stays `m:ss`.
6. **Choosing the language:** first visit follows `navigator.language`; a switch ("English / Tiếng Việt") in the lobby and the game screen; saved in `localStorage`; sets `<html lang>`.
7. **Vietnamese text:** a glossary first (Pilot = Phi công, Co-pilot = Cơ phó, …), then the full `vi.json`; the user reviews both. Check the font covers Vietnamese diacritics.
8. **Layout:** re-check phone layouts with the longer Vietnamese strings.

## Checklist

- [ ] i18next set up; language detection, switch, `localStorage`, `<html lang>`
- [ ] Strings moved: messages and end reasons
- [ ] Strings moved: module, ability, airport and difficulty names and rules
- [ ] Strings moved: lobby, waiting room, status bar, dice tray, cockpit, dialogs, toasts
- [ ] Strings moved: `aria-label`s and SVG titles
- [ ] Plurals and interpolation; code-built strings restructured
- [ ] Number formatting per locale
- [ ] Glossary drafted and reviewed by the user
- [ ] `vi.json` drafted and reviewed by the user; font diacritics checked
- [ ] Phone layouts checked in Vietnamese
- [ ] Tests: key-parity test (`vi.json` has every `en.json` key); components rendered in both languages; one Playwright lobby + round in Vietnamese on a phone; existing tests stay in English

**Done when:** every screen reads fully in Vietnamese (no English left over, `aria-label`s included), switching language updates the app without a reload, the key-parity test passes, and phone layouts still fit.
