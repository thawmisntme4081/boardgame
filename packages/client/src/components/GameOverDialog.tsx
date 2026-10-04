import type { PlayerView } from '@sky/shared';
import { CircleCheck, CircleX, OctagonAlert, PlaneLanding } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { leaveGame, rematch } from '@/api';
import { FlightLog } from '@/components/FlightLog';
import { DifficultyDot, ScenarioPicker } from '@/components/ScenarioPicker';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/i18n';
import { endReasonText } from '@/messages';
import { difficultyName } from '@/scenarioText';

/** "Fly again" on the same scenario, or pick the next one. */
function RematchForm({ view, won }: { view: PlayerView; won: boolean }) {
  const { t } = useTranslation();
  const [setup, setSetup] = useState({ scenario: view.scenario.id });
  return (
    <>
      <ScenarioPicker id="rematch" value={setup} onChange={setSetup} />
      <DialogFooter className="gap-2">
        <Button variant="outline" className="h-11" onClick={() => void leaveGame()}>
          {t('gameOver.leave')}
        </Button>
        <Button
          className={cn('h-11', won && 'bg-emerald-600 text-white hover:bg-emerald-700')}
          onClick={() => void rematch(setup)}
        >
          {t('gameOver.flyAgain')}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * The end of the game. A win and a loss look different at a glance: a green band with a
 * landing plane, or a red band with an alert, and a matching border.
 */
export function GameOverDialog({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  const over = view.phase === 'won' || view.phase === 'lost';
  const won = view.phase === 'won';
  const reasons = view.landingFailures ?? (view.endReason ? [view.endReason] : []);
  const Icon = won ? PlaneLanding : OctagonAlert;

  return (
    <Dialog open={over}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className={cn(
          'max-h-[90dvh] gap-0 overflow-y-auto p-0 ring-2 desktop:max-w-lg!',
          won ? 'ring-emerald-600' : 'ring-danger',
        )}
      >
        <DialogHeader
          className={cn(
            'flex-row items-center gap-3 px-4 py-4 text-white',
            won ? 'bg-emerald-600' : 'bg-danger',
          )}
        >
          <Icon aria-hidden="true" className="size-10 shrink-0" />
          <div className="flex min-w-0 flex-col gap-0.5 text-left">
            <DialogTitle className="text-2xl font-bold text-white">
              {won ? t('gameOver.landed') : t('gameOver.crashed')}
            </DialogTitle>
            <DialogDescription className="text-white/90">
              {won
                ? t('gameOver.landedAt', { airport: view.scenario.airport, round: view.round })
                : t('gameOver.crashedAt', {
                    round: view.round,
                    altitude: formatNumber(view.altitude),
                  })}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-4">
          {won ? (
            <p className="flex items-center gap-2 text-sm">
              <DifficultyDot scenario={view.scenario} />
              <span className="font-medium">{view.scenario.name}</span>
              <span className="text-muted-foreground">
                · {difficultyName(view.scenario.difficulty)}
              </span>
              <CircleCheck aria-label={t('gameOver.done')} className="size-4 text-emerald-600" />
            </p>
          ) : (
            <ul className="space-y-1.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm">
              {reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2">
                  <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />
                  {endReasonText(reason)}
                </li>
              ))}
            </ul>
          )}
          <RematchForm view={view} won={won} />
          <FlightLog className="self-center" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
