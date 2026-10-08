# Pandemic 08: Expansion foundation: modules and a fifth disease

[← Pandemic epic](EPIC.md) · [Master plan](../../PLAN.md) · **Status: ⏳ Not started** · Effort: **medium-high**

Needs [Pandemic 07](phase-07-translations.md) (the base game is done). Expansion phases are optional; this one prepares them all.

## Goals

- Let expansions plug into the core rules as modules, as Sky Team's `RuleModule`s do, without changing the base game's behaviour: the core calls hooks and never tests for a module by name.

## Feature scope

- **In:** a `RuleModule` hook interface and a module list in the game's config (`modules`); module state as a public `GameState` field; a variable disease list (the base four, plus a fifth colour for On the Brink); role and event ids from modules joining the decks; module-aware view, lobby choice and `rules_version` / `migrate` for saved games.
- **Out:** the expansions' content (09–12).

## Tasks

Each task is about one sitting (**L** = low, **M** = medium effort) and ends with its tests passing.

**Rules**

- [ ] 1. **M** `modules/` with the `RuleModule` interface (setup, deck building, infect, epidemic, turn-end, win/lose, view hooks) and a registry; `rules.ts` calls hooks only.
- [ ] 2. **M** Diseases as data (`diseases` in the state, not four constants): cube supply, cures, eradication and the cure win rule work for four or five colours; the base game's tests pass unchanged.
- [ ] 3. **L** Role and event pools as lists a module can extend; a deal that can draw from them.
- [ ] 4. **L** `modules` in `configSchema` and the lobby schema; modules kept in `GameState`; a `migrate` step and a `rules_version` bump if saved states change shape.
- [ ] 5. **L** The engine kit and a fast-check run with a no-op test module.

**Client**

- [ ] 6. **M** The map, tracks and hands read the disease list (colours, supply per colour, cure markers) instead of fixed four; `SetupForm` shows a "Modules" section (empty until 09).
- [ ] 7. **L** Check the base game in Playwright is unchanged.

## Checklist

- [ ] Base game behaves exactly as before (all Pandemic tests and e2e green)
- [ ] The core names no module
- [ ] A test module exercises every hook

**Done when:** a test module changes setup, the infect step and the win rule without the core naming it, and the base game's full run is green.
