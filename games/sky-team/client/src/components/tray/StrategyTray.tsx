import type { PlayerView, Presence } from '@sky/rules';
import { useTranslation } from 'react-i18next';
import { ready } from '../../api';
import { Button } from '@platform/ui/components/button';
import { useNextTurnLeft } from '../../lib/useNextTurn';
import { partnerOf } from '../../partner';
import { TimerNote, TotalTrustNote, TrafficNews, WeatherNote } from './notes';
import { AbilityList, WinConditions } from './popovers';

/**
 * Ends your strategy discussion; the dice roll once both players are ready. Disabled during
 * the green "Next turn in 5s" pause, so the finished round stays on screen for its 5 seconds.
 */
function ReadyButton({ ready: isReady, partnerName }: { ready: boolean; partnerName: string }) {
  const { t } = useTranslation('sky-team');
  const pausing = useNextTurnLeft() !== null;
  return (
    <Button
      className="h-11"
      variant={isReady ? 'outline' : 'default'}
      disabled={isReady || pausing}
      onClick={() => void ready()}
    >
      {isReady ? t('tray.waitingFor', { name: partnerName }) : t('tray.rollDice')}
    </Button>
  );
}

/** Between rounds: what is coming (traffic, weather, timers, rules), then "Roll dice". */
export function StrategyTray({ view, presence }: { view: PlayerView; presence: Presence | null }) {
  return (
    // Notes on the left, "Roll dice" on the right (one column in the tablet side column).
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 tablet:grid-cols-1 desktop:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-1">
        <TrafficNews view={view} />
        {view.autoRoll && <TotalTrustNote />}
        <WeatherNote view={view} />
        <TimerNote view={view} />
        <AbilityList view={view} />
        <WinConditions view={view} className="text-base" />
      </div>
      {/* Total Trust: no button, the dice roll by themselves. */}
      {!view.autoRoll && (
        <ReadyButton
          ready={view.crew.ready[view.seat]}
          partnerName={partnerOf(view, presence).name}
        />
      )}
    </div>
  );
}
