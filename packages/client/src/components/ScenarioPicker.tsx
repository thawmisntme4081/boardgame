import {
  ABILITY_IDS,
  DIFFICULTIES,
  SCENARIO_LIST,
  SCENARIOS,
  type AbilityId,
  type Scenario,
} from '@sky/shared';
import { fitAbilities, scenarioSummary, type SetupChoice } from '@/lib/setup';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { abilityText, DIFFICULTY_DOT, difficultyName, moduleText } from '@/scenarioText';

export function DifficultyDot({ scenario }: { scenario: Scenario }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full',
        DIFFICULTY_DOT[scenario.difficulty],
      )}
    />
  );
}

/** Choose one of the 21 Flight Log scenarios and, when it allows, its Special Abilities. */
export function ScenarioPicker({
  id,
  value,
  onChange,
}: {
  /** Prefix for the form ids (the lobby and the game-over dialog both have a picker). */
  id: string;
  value: SetupChoice;
  onChange: (choice: SetupChoice) => void;
}) {
  const { t } = useTranslation();
  const scenario = SCENARIOS[value.scenario] ?? SCENARIO_LIST[0]!;
  const count = scenario.abilities;

  const pickScenario = (next: string) => {
    const chosen = SCENARIOS[next];
    if (chosen) onChange({ scenario: next, abilities: fitAbilities(chosen, value.abilities) });
  };
  // Always exactly `count` chosen: picking a new one drops the oldest.
  const toggleAbility = (ability: AbilityId) => {
    if (value.abilities.includes(ability)) return;
    onChange({ ...value, abilities: [...value.abilities, ability].slice(-count) });
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${id}-scenario`}>{t('scenario.label')}</Label>
      <Select value={scenario.id} onValueChange={pickScenario}>
        <SelectTrigger id={`${id}-scenario`} className="h-11 w-full text-base">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-80">
          {DIFFICULTIES.map((difficulty) => (
            <SelectGroup key={difficulty}>
              <SelectLabel>{difficultyName(difficulty)}</SelectLabel>
              {SCENARIO_LIST.filter((s) => s.difficulty === difficulty).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <DifficultyDot scenario={s} />
                  {s.name}
                  <span className="sr-only">, {difficultyName(s.difficulty)}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{scenarioSummary(scenario)}</p>
      {scenario.modules.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          {scenario.modules.map((m) => (
            <li key={m}>
              <span className="font-medium text-foreground">{moduleText(m).name}:</span>{' '}
              {moduleText(m).rule}
            </li>
          ))}
        </ul>
      )}
      {count > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            {t('scenario.chooseAbilities', { count })}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {ABILITY_IDS.map((ability) => {
              const on = value.abilities.includes(ability);
              return (
                <Button
                  key={ability}
                  type="button"
                  size="sm"
                  variant={on ? 'default' : 'outline'}
                  aria-pressed={on}
                  title={abilityText(ability).rule}
                  className="h-9"
                  onClick={() => toggleAbility(ability)}
                >
                  {abilityText(ability).name}
                </Button>
              );
            })}
          </div>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {value.abilities.map((ability) => (
              <li key={ability}>
                <span className="font-medium text-foreground">{abilityText(ability).name}:</span>{' '}
                {abilityText(ability).rule}
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </div>
  );
}
