// The waiting room's heading for Sky Team: who is missing, and the chosen scenario and timer.
import type { SeatPresence } from '@platform/ui/game';
import type { PlayerView } from '@sky/rules';
import { useTranslation } from 'react-i18next';
import { DifficultyDot } from './components/ScenarioPicker';
import { formatClock } from './lib/clock';
import { scenarioSummary } from './lib/setup';

export function WaitingInfo({
  view,
  presence,
}: {
  view: PlayerView;
  presence: SeatPresence | null;
}) {
  const { t } = useTranslation('sky-team');
  const missing = presence?.pilot ? 'copilot' : 'pilot';
  const { scenario } = view;
  return (
    <>
      <h2 className="text-xl font-semibold">{t('lobby.waitingFor', { context: missing })}</h2>
      {view.timerMs !== null && (
        <p className="text-sm text-muted-foreground">
          {t('lobby.timedGame', { time: formatClock(view.timerMs) }).trim()}
        </p>
      )}
      <div className="rounded-lg bg-muted/60 px-3 py-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <DifficultyDot scenario={scenario} /> {scenario.name}
        </p>
        <p className="text-xs text-muted-foreground">{scenarioSummary(scenario)}</p>
      </div>
    </>
  );
}
