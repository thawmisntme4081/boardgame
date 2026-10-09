import type { PandemicView, SeatId } from '@pandemic/rules';
import { Button } from '@platform/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@platform/ui/components/dialog';
import { seatInfo, type RematchState, type SeatPresence } from '@platform/ui/game';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { seatName } from '../lib/names';
import { platform } from '../platform';

/**
 * The end of the game: won, or lost with its reason, then "Play again". A new game needs every
 * seated player: the first to press it makes an offer, each other player accepts with their own
 * press, and the server starts the game once all have. Closing the dialog leaves the board to
 * look at; "Game over" in the side column opens it again.
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
  const [closed, setClosed] = useState(false);
  if (view.status === 'playing') return null;
  const won = view.status === 'won';
  const { you } = view;
  // Everyone still seated has to agree; a seat someone left is not waited for.
  const seated = view.seats.filter((seat) => seatInfo(presence, seat));
  const accepted = rematch.accepted ?? [];
  const waitingFor = seated.filter((seat) => !accepted.includes(seat));
  const iAnswered = !!you && accepted.includes(you);
  const offerer = rematch.by;

  return (
    <>
      <Button variant="outline" className="h-11" onClick={() => setClosed(false)}>
        {t('gameOver.show')}
      </Button>
      <Dialog open={!closed} onOpenChange={(open) => setClosed(!open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{won ? t('gameOver.wonTitle') : t('gameOver.lostTitle')}</DialogTitle>
            <DialogDescription>
              {won
                ? t('board.won')
                : t('board.lost', {
                    reason: view.lossReason ? t(`board.lossReason.${view.lossReason}`) : '',
                  })}
            </DialogDescription>
          </DialogHeader>

          {offerer !== null && (
            <p role="status" className="rounded-lg border bg-muted p-3 text-sm">
              {iAnswered
                ? t('gameOver.waitingFor', {
                    names: waitingFor.map((seat) => seatName(presence, seat)).join(', '),
                  })
                : t('gameOver.offered', { name: seatName(presence, offerer as SeatId) })}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-11" onClick={() => void platform().leave()}>
              {t('gameOver.leave')}
            </Button>
            {iAnswered ? (
              <Button
                variant="outline"
                className="h-11"
                onClick={() => void platform().declineRematch()}
              >
                {offerer === you ? t('gameOver.cancelOffer') : t('gameOver.takeBack')}
              </Button>
            ) : (
              <Button className="h-11" onClick={() => void platform().rematch()}>
                {t('gameOver.playAgain')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
