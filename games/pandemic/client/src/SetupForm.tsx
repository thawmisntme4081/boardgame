// Pandemic's lobby options: how many players, the difficulty (epidemic cards) and how the roles
// are given out. The platform page around it holds the name field and the "Create a game" button.
import { EPIDEMIC_COUNTS, MAX_PLAYERS, MIN_PLAYERS, ROLE_MODES } from '@pandemic/rules';
import type { PandemicLobby } from '@pandemic/rules/definition';
import { Button } from '@platform/ui/components/button';
import { ButtonGroup } from '@platform/ui/components/button-group';
import type { SetupFormProps } from '@platform/ui/game';
import { useTranslation } from 'react-i18next';

import { DEFAULT_SETUP } from './setup';

const COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);
const DIFFICULTIES = ['introductory', 'standard', 'heroic'] as const;

function Choice<T extends string | number>({
  id,
  label,
  hint,
  options,
  value,
  onPick,
}: {
  id: string;
  label: string;
  hint?: string;
  options: { value: T; text: string }[];
  value: T;
  onPick: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p id={id} className="text-sm font-medium">
        {label}
      </p>
      <ButtonGroup role="radiogroup" aria-labelledby={id}>
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            variant={value === option.value ? 'default' : 'outline'}
            size="sm"
            className="min-w-12 px-4"
            onClick={() => onPick(option.value)}
          >
            <span className="[text-box:trim-both_cap_alphabetic]">{option.text}</span>
          </Button>
        ))}
      </ButtonGroup>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SetupForm({ value, onChange }: SetupFormProps<PandemicLobby>) {
  const { t } = useTranslation('pandemic');
  const players = value.players ?? DEFAULT_SETUP.players;
  const epidemics = value.epidemics ?? DEFAULT_SETUP.epidemics;
  const roleMode = value.roleMode ?? DEFAULT_SETUP.roleMode;
  return (
    <div className="flex flex-col gap-4">
      <Choice
        id="pandemic-players"
        label={t('lobby.players')}
        options={COUNTS.map((count) => ({ value: count, text: String(count) }))}
        value={players as number}
        onPick={(count) => onChange({ ...value, players: count })}
      />
      <Choice
        id="pandemic-difficulty"
        label={t('lobby.difficulty.title')}
        hint={t('lobby.difficulty.hint', { count: epidemics })}
        options={EPIDEMIC_COUNTS.map((count, i) => ({
          value: count,
          text: t(`lobby.difficulty.${DIFFICULTIES[i] as (typeof DIFFICULTIES)[number]}`),
        }))}
        value={epidemics as number}
        onPick={(count) => onChange({ ...value, epidemics: count })}
      />
      <Choice
        id="pandemic-roles"
        label={t('lobby.roleMode.title')}
        hint={t(`lobby.roleMode.${roleMode as (typeof ROLE_MODES)[number]}Hint`)}
        options={ROLE_MODES.map((mode) => ({ value: mode, text: t(`lobby.roleMode.${mode}`) }))}
        value={roleMode as string}
        onPick={(mode) => onChange({ ...value, roleMode: mode as (typeof ROLE_MODES)[number] })}
      />
    </div>
  );
}
