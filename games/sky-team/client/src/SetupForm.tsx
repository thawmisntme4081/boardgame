// Sky Team's lobby options: the scenario and the round timer. The platform page around it holds
// the name field and the "Create a game" button.
import { Label } from '@platform/ui/components/label';
import { Switch } from '@platform/ui/components/switch';
import type { SetupFormProps } from '@platform/ui/game';
import { ROUND_TIMER_MS, type GameSetup } from '@sky/rules';
import { useTranslation } from 'react-i18next';
import { FlightLog } from './components/FlightLog';
import { ScenarioPicker } from './components/ScenarioPicker';
import { formatClock } from './lib/clock';
import { DEFAULT_SETUP } from './lib/setup';

export function SetupForm({ value, onChange }: SetupFormProps<GameSetup>) {
  const { t } = useTranslation('sky-team');
  return (
    <>
      <ScenarioPicker
        id="lobby"
        value={{ scenario: value.scenario ?? DEFAULT_SETUP.scenario }}
        onChange={(choice) => onChange({ ...value, ...choice })}
      />
      {/* The whole row is the label, so it is an easy target on a phone. */}
      <Label htmlFor="timer" className="flex min-h-11 cursor-pointer items-center gap-3">
        <span className="flex flex-1 flex-col gap-0.5">
          <span>{t('lobby.roundTimer')}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {t('lobby.roundTimerHint', { time: formatClock(ROUND_TIMER_MS) })}
          </span>
        </span>
        <Switch
          id="timer"
          checked={value.timer ?? false}
          onCheckedChange={(timer) => onChange({ ...value, timer })}
        />
      </Label>
      <FlightLog />
    </>
  );
}
