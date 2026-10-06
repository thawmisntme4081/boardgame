import { DIFFICULTIES, SCENARIO_LIST, SCENARIOS, type Scenario } from '@sky/rules';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Label } from '@platform/ui/components/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@platform/ui/components/select';
import { landedScenarios } from '../lib/history';
import { scenarioSummary, type SetupChoice } from '../lib/setup';
import { cn } from '@platform/ui/utils';
import { DIFFICULTY_DOT, difficultyName, moduleText, weatherText } from '../scenarioText';
import { useSkyTeam } from '../store';

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
  const { t } = useTranslation('sky-team');
  const scenario = SCENARIOS[value.scenario] ?? SCENARIO_LIST[0]!;
  // Modules, then the altitude track's weather, each with its rule.
  const rules = [
    ...scenario.modules.map((m) => ({ id: m as string, ...moduleText(m) })),
    ...weatherText(scenario),
  ];
  // Scenarios landed on this device get a ✓ (the Flight Log's victory boxes).
  const history = useSkyTeam((s) => s.history);
  const landed = landedScenarios(history);

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
                  {landed.has(s.id) && (
                    <Check
                      role="img"
                      aria-label={t('flightLog.landed')}
                      className="size-4 text-emerald-600"
                    />
                  )}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{scenarioSummary(scenario)}</p>
      {rules.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          {rules.map(({ id, name, rule }) => (
            <li key={id}>
              <span className="font-medium text-foreground">{name}:</span> {rule}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
