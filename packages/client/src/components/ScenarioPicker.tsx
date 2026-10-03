import { DIFFICULTIES, SCENARIO_LIST, SCENARIOS, type Scenario } from '@sky/shared';
import { scenarioSummary, type SetupChoice } from '@/lib/setup';
import { useTranslation } from 'react-i18next';
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
import { DIFFICULTY_DOT, difficultyName, moduleText } from '@/scenarioText';

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

/** Choose a Flight Log scenario (its Special Abilities are picked in the game, before round 1). */
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

  const pickScenario = (next: string) => {
    if (SCENARIOS[next]) onChange({ scenario: next });
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
    </div>
  );
}
