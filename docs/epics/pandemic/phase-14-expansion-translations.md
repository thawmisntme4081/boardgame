# Pandemic 14: Expansion translations

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏸ On hold** (the user's decision, 2026-10-20) · Effort: **low**

Needs the expansion phases you built (10–13). Same way of working as [Pandemic 07](phase-07-translations.md).

## Goals

- The expansion content in English, Vietnamese and French.

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with typecheck, lint and format passing; tests are written and run at the end of the phase, after your review.

- [ ] 1. **L** Glossary additions: new roles, events, challenges, terms.
- [ ] 2. **M** `vi.json` and `fr.json` for the new keys; the key-parity test passes.
- [ ] 3. **L** Check long labels on a desktop screen in all three languages.

**Checks**

- [ ] 4. **M** Write the phase's tests and run the full suite: `pnpm test`, `pnpm e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (after your review of the other tasks).

## Checklist

- [ ] Glossary updated and reviewed
- [ ] Key parity for all three files

**Done when:** every expansion screen reads correctly in all three languages.
