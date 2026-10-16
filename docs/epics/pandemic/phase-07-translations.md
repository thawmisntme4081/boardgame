# Pandemic 07: Translations

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **medium**

Needs [Pandemic 06](phase-06-setup-and-variants.md) and all 12 roles of [Pandemic 04](phase-04-roles.md), so the translations cover every text at once. Follow Sky Team 10's way of working: glossary first, then the files.

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

**Checks**

- [ ] 5. **M** Write the phase's tests and run the full suite: `pnpm test`, `pnpm e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (after your review of the other tasks).

## Checklist

- [ ] Glossary written and reviewed
- [ ] `vi.json` and `fr.json` complete, key-parity test passing
- [ ] Layout checked in all three languages on desktop

## Settled with the user

- **Order:** all 12 roles (Pandemic 04) are finished first; this phase then translates every text, theirs included.
- **City names are translated.** French: the published edition's names. Vietnamese: the common Vietnamese name where one is standard (Bắc Kinh, Thượng Hải, Hồng Kông, TP. Hồ Chí Minh, Mát-xcơ-va…), the Latin spelling otherwise (London, Paris, New York, Lagos).
- **One short name per city and language**, used on the map, the cards and the menus (`cities.<id>` keys; `cityName` reads them instead of building the name from the id), shortened where needed (TP. Hồ Chí Minh, St-Pétersbourg); a name that still does not fit wraps onto two lines on the map.
- **Review:** the user reviews the Vietnamese glossary and `vi.json`; Claude reviews the French, as in Sky Team 10. French addresses the players as "vous".
- **Tests:** key parity and placeholder checks (as Sky Team's `i18n.test.tsx`), the board rendered in Vietnamese and French, and one Playwright test on Desktop Chrome only (a Vietnamese and a French player play one turn).
- **Found while studying:** the map's `aria-label="Map"` is hard-coded English, and `i18n.ts` maps `vi` and `fr` to `en.json`; both are fixed in task 2.

**Done when:** a full game reads correctly in all three languages, with the key-parity test passing.
