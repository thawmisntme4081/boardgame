// Names and one-line rules for the Flight Log modules and Special Ability cards (texts in
// locales/*.json).
import type { AbilityId, Difficulty, ModuleId } from '@sky/shared';
import { t } from '@/i18n';

export const moduleText = (id: ModuleId): { name: string; rule: string } => ({
  name: t(`moduleText.${id}.name`),
  rule: t(`moduleText.${id}.rule`),
});

export const abilityText = (id: AbilityId): { name: string; rule: string } => ({
  name: t(`abilityText.${id}.name`),
  rule: t(`abilityText.${id}.rule`),
});

export const difficultyName = (difficulty: Difficulty): string => t(`difficulty.${difficulty}`);

/** The scenario colour dot. */
export const DIFFICULTY_DOT: Record<Difficulty, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-600',
  black: 'bg-neutral-900 ring-1 ring-neutral-400',
};
