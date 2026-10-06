// Names and one-line rules for the Flight Log modules and Special Ability cards (texts in
// locales/*.json).
import type { AbilityId, Difficulty, ModuleId, Scenario } from '@sky/rules';
import { formatNumber, t } from './i18n';

export const moduleText = (id: ModuleId): { name: string; rule: string } => ({
  name: t(`moduleText.${id}.name`),
  rule: t(`moduleText.${id}.rule`),
});

export const abilityText = (id: AbilityId): { name: string; rule: string } => ({
  name: t(`abilityText.${id}.name`),
  rule: t(`abilityText.${id}.rule`),
});

/** The airport code, numbered when the airport has two scenarios of a colour: `DUS1`, `DUS2`. */
export const scenarioCode = (scenario: Scenario): string =>
  scenario.airport + (/\d+$/.exec(scenario.id)?.[0] ?? '');

/** Turbulence and Bad Visibility on the altitude track, like a module: name, rule, altitudes. */
export function weatherText(scenario: Scenario): { id: string; name: string; rule: string }[] {
  return (['turbulence', 'badVisibility'] as const).flatMap((id) => {
    const at = scenario.altitudes.filter((a) => a[id]).map((a) => formatNumber(a.altitude));
    if (at.length === 0) return [];
    return [
      {
        id,
        name: t(`weather.${id}`),
        rule: t(`weather.${id}Lobby`, { altitudes: at.join(' · ') }),
      },
    ];
  });
}

export const difficultyName = (difficulty: Difficulty): string => t(`difficulty.${difficulty}`);

/** The scenario color dot. */
export const DIFFICULTY_DOT: Record<Difficulty, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-600',
  black: 'bg-neutral-900 ring-1 ring-neutral-400',
};
