# Phase 10: Internationalisation (English + Vietnamese)

[← Master plan](../PLAN.md) · Milestone M4 · **Status: ✅ Done** · Effort: **medium** (mostly volume)

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
6. **Choosing the language:** English by default, whatever the browser language; a switch (`LanguageSwitch`) ("English / Tiếng Việt") in the lobby and the game screen; saved in `localStorage`; sets `<html lang>`.
7. **Vietnamese text:** a glossary first (Pilot = Phi công, Co-pilot = Cơ phó, …), then the full `vi.json`; the user reviews both. Check the font covers Vietnamese diacritics.
8. **Layout:** re-check phone layouts with the longer Vietnamese strings.

## Checklist

- [x] i18next set up; English default, switch, `localStorage`, `<html lang>`
- [x] Strings moved: messages and end reasons
- [x] Strings moved: module, ability and difficulty names and rules (airport names are proper names and stay as they are)
- [x] Strings moved: lobby, waiting room, status bar, dice tray, cockpit, dialogs, toasts
- [x] Strings moved: `aria-label`s and SVG titles
- [x] Plurals and interpolation; code-built strings restructured (`slotLabel()`, turn text)
- [x] Number formatting per locale
- [x] Glossary drafted (below)
- [x] Glossary reviewed by the user
- [x] `vi.json` drafted; font diacritics checked (Geist with its Vietnamese subset)
- [x] `vi.json` reviewed by the user
- [x] Phone layouts checked in Vietnamese (the dice tray keeps four dice on one row; long ability buttons wrap)
- [x] Tests: key-parity test (`i18n.test.tsx`); components rendered in Vietnamese; Playwright `e2e/i18n.spec.ts` (Vietnamese pilot, English co-pilot, one die placed) on all three devices; existing tests stay in English

**Done when:** every screen reads fully in Vietnamese (no English left over, `aria-label`s included), switching language updates the app without a reload, the key-parity test passes, and phone layouts still fit. ✅ Verified 2026-10-01

## Glossary

| English | Tiếng Việt |
| --- | --- |
| Pilot / Co-pilot | Phi công / Cơ phó |
| Axis | Trục |
| Engines | Động cơ |
| Radio | Radio |
| Online | Online |
| Offline | Offline |
| Landing gear | Càng đáp |
| Flaps | Cánh tà |
| Brakes | Phanh |
| Concentration / coffee | Tập trung / cà phê |
| Reroll | Đổ lại |
| Approach / Altitude | Đường tiếp cận / Độ cao |
| Scenario | Kịch bản |
| Kerosene / Kerosene leak | Nhiên liệu / Rò rỉ nhiên liệu |
| Intern | Thực tập sinh |
| Wind | Gió |
| Ice brakes | Phanh băng |
| Traffic die | Xúc xắc giao thông |
| Real-time | Thời gian thực |
| Adaptation, Anticipation, Control, Mastery, Synchronisation, Working Together | Thích ứng, Đoán trước, Kiểm soát, Thành thạo, Đồng bộ, Phối hợp |
| Routine landing / Special conditions / Elite pilots only / Heroic landing | Hạ cánh thường lệ / Điều kiện đặc biệt / Chỉ dành cho phi công ưu tú / Hạ cánh anh hùng |
