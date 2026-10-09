# Pandemic 07: Translations

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **medium**

Needs [Pandemic 06](phase-06-setup-and-history.md). Follow Sky Team 10's way of working: glossary first, then the files.

## Goals

- The game in English, Vietnamese and French.

## Feature scope

- **In:** `games/pandemic/client/src/locales/{en,vi,fr}.json` (same keys), a glossary in this file (roles, events, actions, diseases, tracks, cities), plurals `_one` / `_other`, French spacing (no-break spaces before `: ; ! ?`), the `games.pandemic` texts in the platform locales.

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with typecheck, lint and format passing; tests are written and run at the end of the phase, after your review.

- [ ] 1. **M** Glossary: each English term with its Vietnamese and French name (the published French edition's terms where known); the user reviews the Vietnamese.
- [ ] 2. **M** `vi.json` and a key-parity test (as Sky Team's `i18n.test.tsx`).
- [ ] 3. **M** `fr.json`.
- [ ] 4. **L** City names on the map in each language; check that long labels fit.

## Checklist

- [ ] Glossary written and reviewed
- [ ] `vi.json` and `fr.json` complete, key-parity test passing
- [ ] Layout checked in all three languages on desktop

## Open questions

- City names: translated (e.g. "Thành phố Hồ Chí Minh") or kept in English on the map? Assumption (to confirm): translated, from the glossary.

**Done when:** a full game reads correctly in all three languages, with the key-parity test passing.
