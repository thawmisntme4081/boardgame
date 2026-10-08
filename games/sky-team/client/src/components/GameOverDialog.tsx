import type { RematchState } from '@platform/ui/game';
import { SCENARIOS, type PlayerView, type Presence } from '@sky/rules';
import {
  CircleCheck,
  CircleX,
  Eye,
  Hourglass,
  OctagonAlert,
  PlaneLanding,
  PlaneTakeoff,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { declineRematch, leaveGame, rematch as rematch_ } from '../api';
import { partnerOf } from '../partner';
import { FlightLog } from './FlightLog';
import { DifficultyDot, ScenarioPicker } from './ScenarioPicker';
import { Button } from '@platform/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@platform/ui/components/dialog';
import { cn } from '@platform/ui/utils';
import { formatNumber } from '../i18n';
import { useSkyTeam } from '../store';
import { endReasonText } from '../messages';
import { difficultyName } from '../scenarioText';

/** A yellow note, shaped like the list of crash reasons: where a rematch offer stands. */
function OfferNote({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm"
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <span>{children}</span>
    </p>
  );
}

/**
 * "Fly again" needs both players: the first to press it makes an offer (their scenario), the
 * other accepts with their own "Fly again" or says "Not now". Offers and answers come from
 * the server (`rematch`); nothing restarts until both agree.
 */
function RematchForm({
  view,
  won,
  presence,
  rematch,
}: {
  view: PlayerView;
  won: boolean;
  presence: Presence | null;
  rematch: RematchState;
}) {
  const { t } = useTranslation('sky-team');
  const [setup, setSetup] = useState({ scenario: view.scenario.id });
  const partner = partnerOf(view, presence);
  const flyClass = cn('h-11', won && 'bg-emerald-600 text-white hover:bg-emerald-700');
  const leave = (
    <Button variant="outline" className="h-11" onClick={() => void leaveGame()}>
      {t('gameOver.leave')}
    </Button>
  );

  if (rematch.by === view.seat) {
    return (
      <>
        <OfferNote icon={Hourglass}>{t('gameOver.offerWaiting', { name: partner.name })}</OfferNote>
        <DialogFooter className="gap-2">
          {leave}
          <Button variant="outline" className="h-11" onClick={() => void declineRematch()}>
            {t('gameOver.cancelOffer')}
          </Button>
        </DialogFooter>
      </>
    );
  }
  if (rematch.by !== null) {
    const offered = SCENARIOS[(rematch.config as { scenario?: string } | null)?.scenario ?? ''];
    return (
      <>
        <OfferNote icon={PlaneTakeoff}>
          {t('gameOver.offered', { name: partner.name })}
          {offered && ` ${offered.name}`}
        </OfferNote>
        <DialogFooter className="gap-2">
          {leave}
          <Button className={flyClass} onClick={() => void rematch_()}>
            {t('gameOver.flyAgain')}
          </Button>
        </DialogFooter>
      </>
    );
  }
  return (
    <>
      <ScenarioPicker id="rematch" value={setup} onChange={setSetup} />
      <p className="text-xs text-muted-foreground">
        {t('gameOver.scenarioNote', { name: partner.name })}
      </p>
      <DialogFooter className="gap-2">
        {leave}
        <Button className={flyClass} onClick={() => void rematch_(setup)}>
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
export function GameOverDialog({
  view,
  presence,
  rematch,
}: {
  view: PlayerView;
  presence: Presence | null;
  rematch: RematchState;
}) {
  const { t } = useTranslation('sky-team');
  const over = view.phase === 'won' || view.phase === 'lost';
  const won = view.phase === 'won';
  const reasons = view.landingFailures ?? (view.endReason ? [view.endReason] : []);
  const Icon = won ? PlaneLanding : OctagonAlert;
  // "View board" hides the dialog to look at the final board; a banner brings it back. A
  // rematch offer (or taking one back) shows the dialog again, so nobody misses it.
  const [hiddenFor, setHiddenFor] = useState<string | null | false>(false);
  const setViewingBoard = useSkyTeam((s) => s.setViewingBoard);
  const hidden = hiddenFor !== false && hiddenFor === rematch.by;

  return (
    <>
      {over && hidden && (
        <div
          role="status"
          className={cn(
            'fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-3 text-white shadow-lg',
            won ? 'bg-emerald-600' : 'bg-danger',
          )}
        >
          <Icon aria-hidden="true" className="size-6 shrink-0" />
          <span className="min-w-0 flex-1 font-semibold">
            {won ? t('gameOver.landed') : t('gameOver.crashed')}
          </span>
          <Button
            variant="secondary"
            className="h-11"
            onClick={() => {
              setHiddenFor(false);
              setViewingBoard(false);
            }}
          >
            {t('gameOver.showResult')}
          </Button>
        </div>
      )}
      <Dialog open={over && !hidden}>
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
            <RematchForm view={view} won={won} presence={presence} rematch={rematch} />
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="ghost"
                className="h-11"
                onClick={() => {
                  setHiddenFor(rematch.by);
                  setViewingBoard(true);
                }}
              >
                <Eye /> {t('gameOver.viewBoard')}
              </Button>
              <FlightLog />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
