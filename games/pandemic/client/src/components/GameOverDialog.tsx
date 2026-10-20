import type { PandemicView, SeatId } from '@pandemic/rules';
import { MAX_OUTBREAKS } from '@pandemic/rules';
import { Button } from '@platform/ui/components/button';
import { DialogFooter } from '@platform/ui/components/dialog';
import { GameOverFrame, OfferNote } from '@platform/ui/GameOver';
import { seatInfo, type RematchState, type SeatPresence } from '@platform/ui/game';
import { cn } from '@platform/ui/utils';
import { Biohazard, CircleCheck, CircleX, Hourglass, RefreshCw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { seatName } from '../lib/names';
import { platform } from '../platform';

/**
 * The end of the game, laid out like Sky Team's (`GameOverFrame`): a green band when the diseases
 * are cured, a red one when the world was lost with its reason, the game's figures, then "Play
 * again". A new game needs every seated player: the first to press it makes an offer, each other
 * player accepts with their own press, and the server starts the game once all have. "View
 * board" hides the result to look at the final board; the bar at the bottom brings it back.
 */
export function GameOverDialog({
  view,
  presence,
  rematch,
}: {
  view: PandemicView;
  presence: SeatPresence | null;
  rematch: RematchState;
}) {
  const { t } = useTranslation('pandemic');
  // The result hidden to look at the board; a new rematch offer (or taking it back) shows it again.
  const [hiddenFor, setHiddenFor] = useState<string | null | false>(false);
  const over = view.status !== 'playing';
  const won = view.status === 'won';
  const { you } = view;
  const hidden = hiddenFor !== false && hiddenFor === rematch.by;
  // Everyone still seated has to agree; a seat someone left is not waited for.
  const seated = view.seats.filter((seat) => seatInfo(presence, seat));
  const accepted = rematch.accepted ?? [];
  const waitingFor = seated.filter((seat) => !accepted.includes(seat));
  const iAnswered = !!you && accepted.includes(you);
  const offerer = rematch.by;
  const playAgain = cn('h-11', won && 'bg-emerald-600 text-white hover:bg-emerald-700');

  return (
    <GameOverFrame
      over={over}
      won={won}
      icon={won ? ShieldCheck : Biohazard}
      title={won ? t('gameOver.wonTitle') : t('gameOver.lostTitle')}
      description={
        won
          ? t('board.won')
          : `${t('tracks.outbreaks', { count: view.outbreaks, max: MAX_OUTBREAKS })} · ${t('lobby.epidemics', { count: view.epidemics })}`
      }
      hidden={hidden}
      onHideResult={() => setHiddenFor(rematch.by)}
      onShowResult={() => setHiddenFor(false)}
      viewBoardLabel={t('gameOver.viewBoard')}
      showResultLabel={t('gameOver.showResult')}
    >
      {won ? (
        <p className="flex items-center gap-2 text-sm">
          <span className="font-medium">{t('gameOver.cured')}</span>
          <span className="text-muted-foreground">
            · {t('tracks.outbreaks', { count: view.outbreaks, max: MAX_OUTBREAKS })} ·{' '}
            {t('lobby.epidemics', { count: view.epidemics })}
          </span>
          <CircleCheck aria-hidden="true" className="size-4 text-emerald-600" />
        </p>
      ) : (
        <ul className="space-y-1.5 rounded-lg border border-red-600/30 bg-red-600/10 p-3 text-sm">
          <li className="flex items-start gap-2">
            <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-red-600" />
            {view.lossReason ? t(`board.lossReason.${view.lossReason}`) : ''}
          </li>
        </ul>
      )}

      {offerer !== null && (
        <OfferNote icon={iAnswered ? Hourglass : RefreshCw}>
          {iAnswered
            ? t('gameOver.waitingFor', {
                names: waitingFor.map((seat) => seatName(presence, seat)).join(', '),
              })
            : t('gameOver.offered', { name: seatName(presence, offerer as SeatId) })}
        </OfferNote>
      )}

      <DialogFooter className="gap-2">
        <Button variant="outline" className="h-11" onClick={() => void platform().leave()}>
          {t('common.leave')}
        </Button>
        {iAnswered ? (
          <Button
            variant="outline"
            className="h-11"
            onClick={() => void platform().declineRematch()}
          >
            {offerer === you ? t('common.cancelOffer') : t('gameOver.takeBack')}
          </Button>
        ) : (
          <Button className={playAgain} onClick={() => void platform().rematch()}>
            {t('gameOver.playAgain')}
          </Button>
        )}
      </DialogFooter>
    </GameOverFrame>
  );
}
