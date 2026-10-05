# Sky Team 10: I18n (English + Vietnamese + French)

[← Sky Team epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ✅ Done (stage 1 English + Vietnamese; stage 2 French, Oct 5, 2026)** · Effort: stage 1 **medium** (mostly volume); stage 2 **low-medium** (see below)

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

**Stage 1 done when:** every screen reads fully in Vietnamese (no English left over, `aria-label`s included), switching language updates the app without a reload, the key-parity test passes, and phone layouts still fit. ✅ Verified 2026-10-01

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
| Flight Log | Nhật ký bay |
| History | Lịch sử |
| W/L (wins/losses) | T/B (thắng/bại) |
| Ice brakes | Phanh băng |
| Traffic die | Xúc xắc giao thông |
| Real-time | Thời gian thực |
| Adaptation, Anticipation, Control, Mastery, Synchronization, Working Together | Thích ứng, Đoán trước, Kiểm soát, Thành thạo, Đồng bộ, Phối hợp |
| Routine landing / Special conditions / Elite pilots only / Heroic landing | Hạ cánh thường lệ / Điều kiện đặc biệt / Chỉ dành cho phi công ưu tú / Hạ cánh anh hùng |

## Stage 2: French (added Oct 5, 2026)

A third language, French, on the same setup: no new library, no new architecture. Sky Team was first published in French (Le Scorpion Masqué), so the French rulebook's own terms exist and are the reference for the glossary.

### Effort: low-medium (about 1–2 sessions plus the review)

| Part | Size | Notes |
| --- | --- | --- |
| Code | Small (about an hour) | `LANGUAGES` gets `fr: 'Français'`; `savedLanguage()` accepts any listed code instead of only `'vi'`; `fr.json` added to the i18next resources; the switch lists three languages. The Geist font already covers French accents. |
| Translation | Medium (volume) | 374 strings, about 2,100 English words: module and ability rules, cockpit labels, `aria-label`s, errors, end reasons, toasts, Flight Log. |
| Review | The real bottleneck | A French reader checks the glossary first, then `fr.json` in the app (as the user did for Vietnamese). |
| Layout | Small | French runs about 15–25% longer than English: re-check the phone dice tray, ability buttons, status pills and the Flight Log table. |
| Tests | Small | The key-parity test covers every language in `LANGUAGES` (not only `vi`); one component test rendered in French; the switch test lists three languages. No new Playwright test needed. |

### Technical tasks

1. **Glossary first:** French terms for the game words (Pilot, Co-pilot, Axis, Engines, Landing gear, Flaps, Brakes, Concentration, Reroll, Approach, Altitude, the modules, the six Special Abilities, the four difficulty names, Flight Log…), taken from the French edition's rulebook where it has them; reviewed before the full translation.
2. **Code:** `fr` in `LANGUAGES`; `savedLanguage()` generalized; `fr.json` in the resources; `<html lang="fr">`.
3. **`fr.json`:** the full translation, same keys as `en.json`; plurals as `_one` / `_other` (in French, 0 takes the singular, which i18next handles).
4. **French typography:** a narrow no-break space before `: ; ! ?` and inside « » quotes (France style; see open questions); numbers from `Intl.NumberFormat('fr')` ("6 000 ft"); dates from `Intl.DateTimeFormat('fr')` in the History list.
5. **Layout pass** on phone, tablet and desktop in French.
6. **Tests** as in the table above.

### Checklist

- [x] Glossary drafted from the French rulebook terms (French glossary below)
- [x] Glossary reviewed (by Claude, as agreed)
- [x] `fr` added to `LANGUAGES`; saved choice and `<html lang>` work for three languages (`isLanguage` in `i18n.ts`)
- [x] `fr.json` drafted (374 strings, same keys and placeholders as `en.json`)
- [x] `fr.json` reviewed in the app (by Claude: lobby, before take-off, placing tray, cockpit, game over)
- [x] French typography: narrow no-break space before `; ! ?`, no-break space before `:` and between a number and `ft` / `s`; numbers and dates from `Intl`
- [x] Phone and desktop layouts checked in French (long ability buttons wrap on phones; the desktop tray keeps one row)
- [x] Tests: key parity for Vietnamese and French; placeholder and tag parity for French; the status bar, errors and end reasons in French; the switch offers and remembers Français

**Stage 2 done when:** every screen reads fully in French (no English left over, `aria-label`s included), the switch offers English / Tiếng Việt / Français without a reload, the key-parity test passes for all three files, and phone layouts still fit. ✅ Verified Oct 5, 2026 (363 unit tests; typecheck, lint, format and build green).

### French glossary

✔ = the term appears in the French publisher's own material (Le Scorpion Masqué); the others are our translation, in the same plain style, to swap for the rulebook's word if it differs.

| English | Français |
| --- | --- |
| Pilot / Co-pilot | Pilote / Copilote ✔ |
| Axis | Axe ✔ |
| Engines | Moteurs |
| Radio | Radio ✔ |
| Landing gear | Train d'atterrissage ✔ |
| Flaps | Volets ✔ |
| Brakes | Freins ✔ |
| Concentration / coffee | Concentration / café ✔ |
| Reroll (token) | Relance (jeton Relance) |
| Round | Manche |
| Approach / Altitude | Approche / Altitude |
| Scenario | Scénario |
| Kerosene / Kerosene leak | Kérosène / Fuite de kérosène |
| Intern | Stagiaire |
| Wind | Vent |
| Ice brakes | Freins sur glace |
| Traffic die | Dé Trafic |
| Real-time | Temps réel |
| Turbulence / Bad visibility / Alarms | Turbulences ✔ / Manque de visibilité ✔ / Alarmes ✔ |
| Total Trust | Confiance totale |
| Belly landing / Engines out / Wind upside down | Atterrissage sur le ventre / Moteurs en panne / Vent inversé |
| Adaptation, Anticipation, Control, Mastery, Synchronization, Working Together | Adaptation, Anticipation, Contrôle, Maîtrise, Synchronisation, Travail d'équipe |
| Routine landing / Exceptional conditions / Elite pilots only / Heroic landing | Atterrissage de routine / Conditions exceptionnelles / Réservé aux pilotes d'élite / Atterrissage héroïque |
| Flight Log / History / W/L | Carnet de vol / Historique / V/D |
| No talking!!! | Silence !!! |

### Open questions
