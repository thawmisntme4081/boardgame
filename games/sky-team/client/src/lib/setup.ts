// The scenario chosen in the lobby or after a game (roles and abilities are chosen in the game).
import { YUL, type PlayerView, type Scenario } from '@sky/rules';
import { t } from '../i18n';
import { difficultyName, moduleText } from '../scenarioText';

/** A scenario to fly. */
export interface SetupChoice {
  scenario: string;
}

/** "Exceptional conditions · Kerosene · 2 abilities" */
export function scenarioSummary(scenario: Scenario): string {
  const parts = [
    difficultyName(scenario.difficulty),
    ...scenario.modules.map((m) => moduleText(m).name),
  ];
  if (scenario.abilities > 0) parts.push(t('scenario.abilityCount', { count: scenario.abilities }));
  return parts.join(' · ');
}

/** Before round 1: roles and abilities are chosen until both players confirm. */
export const isBeforeTakeoff = (view: PlayerView): boolean => view.phase === 'setup';

/** Every Special Ability card the scenario allows has been chosen. */
export const abilitiesChosen = (view: PlayerView): boolean =>
  view.abilities.length === view.scenario.abilities;

/** The first game in the lobby: the base scenario. */
export const DEFAULT_SETUP: SetupChoice = { scenario: YUL.id };
