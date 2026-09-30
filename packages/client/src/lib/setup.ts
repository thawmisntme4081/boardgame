// The scenario and Special Abilities chosen in the lobby or after a game.
import { ABILITY_IDS, DIFFICULTY_NAMES, YUL, type AbilityId, type Scenario } from '@sky/shared';
import { MODULE_TEXT } from '@/scenarioText';

/** A scenario and the Special Ability cards chosen for it. */
export interface SetupChoice {
  scenario: string;
  abilities: AbilityId[];
}

/** Keeps the abilities already chosen that still fit, topped up with the first free ones. */
export function fitAbilities(scenario: Scenario, chosen: readonly AbilityId[]): AbilityId[] {
  const kept = chosen.slice(0, scenario.abilities);
  const free = ABILITY_IDS.filter((a) => !kept.includes(a));
  return [...kept, ...free].slice(0, scenario.abilities);
}

/** "Exceptional conditions · Kerosene · 2 abilities" */
export function scenarioSummary(scenario: Scenario): string {
  const parts = [
    DIFFICULTY_NAMES[scenario.difficulty],
    ...scenario.modules.map((m) => MODULE_TEXT[m].name),
  ];
  if (scenario.abilities > 0) {
    parts.push(`${scenario.abilities} ${scenario.abilities === 1 ? 'ability' : 'abilities'}`);
  }
  return parts.join(' · ');
}

/** The first game in the lobby: the base scenario. */
export const DEFAULT_SETUP: SetupChoice = { scenario: YUL.id, abilities: [] };
