import { otherSeat, type PlayerView, type Presence } from '@sky/shared';
import { LogOut, WifiOff } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { leaveGame } from '@/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatNumber, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { seatName } from '@/messages';
import { LanguageSwitch } from './LanguageSwitch';
import { NextTurnCountdown } from './NextTurnCountdown';
import { RoundCountdown } from './RoundCountdown';
import { useNow } from '@/lib/useNow';
import { useGame, type Connection } from '@/store';

function turnText(view: PlayerView, partner: string): string {
  switch (view.phase) {
    case 'strategy':
      return t('status.strategy');
    case 'placing':
      return view.currentSeat === view.seat
        ? t('status.yourTurn')
        : t('status.partnersTurn', { name: partner });
    case 'won':
      return t('status.landed');
    case 'lost':
      return t('status.crashed');
  }
}

/** Gives up your seat, after a confirmation; your partner's game restarts. */
function LeaveButton({ partnerName }: { partnerName: string }) {
  const { t } = useTranslation();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 hover:bg-danger hover:text-white"
          aria-label={t('leave.button')}
        >
          <LogOut />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('leave.title')}</DialogTitle>
          <DialogDescription>{t('leave.body', { name: partnerName })}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="h-11">
              {t('leave.stay')}
            </Button>
          </DialogClose>
          <Button variant="destructive" className="h-11" onClick={() => void leaveGame()}>
            {t('leave.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StatusBar({
  view,
  presence,
  connection,
}: {
  view: PlayerView;
  presence: Presence | null;
  connection: Connection;
}) {
  const { t } = useTranslation();
  const partnerSeat = otherSeat(view.seat);
  const partner = presence?.[partnerSeat];
  const partnerName = partner?.name ?? seatName(partnerSeat);
  const myTurn = view.phase === 'placing' && view.currentSeat === view.seat;
  // During the green "Next turn in 5s" pause, that countdown is the only pill.
  const nextTurnAt = useGame((s) => s.nextTurnAt);
  const now = useNow();
  const pausing = view.phase === 'strategy' && nextTurnAt !== null && now < nextTurnAt;

  return (
    <header className="flex flex-col gap-2 border-b bg-background px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
      {connection !== 'online' && (
        <p
          className="flex items-center gap-2 rounded-md bg-danger/10 px-3 py-1 text-sm text-danger"
          role="alert"
        >
          <WifiOff className="size-4" aria-hidden="true" />
          {connection === 'connecting' ? t('status.reconnecting') : t('status.offline')}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold tabular-nums">
              {t('status.round', {
                round: view.round,
                rounds: view.scenario.altitudes.length,
                altitude: formatNumber(view.altitude),
              })}
              {view.finalRound && (
                <span className="ml-2 rounded bg-danger px-1.5 py-0.5 text-xs text-white">
                  {t('status.final')}
                </span>
              )}
            </p>
            <p className="flex flex-col text-xs text-muted-foreground tablet:flex-row tablet:gap-1">
              <span className="truncate">
                <Trans
                  i18nKey="status.youAre"
                  values={{ seat: seatName(view.seat) }}
                  components={{
                    seat: (
                      <span className={view.seat === 'pilot' ? 'text-pilot' : 'text-copilot'} />
                    ),
                  }}
                />
                <span className="hidden tablet:inline"> ·</span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-1">
                <span
                  className={cn(
                    'inline-block size-2 rounded-full',
                    partner?.online ? 'bg-light-on' : 'bg-danger',
                  )}
                  aria-hidden="true"
                />
                {partner?.online
                  ? t('status.partnerOnline', { name: partnerName })
                  : t('status.partnerOffline', { name: partnerName })}
              </span>
            </p>
          </div>
        </div>
        {/*
          The right box. Phones: Leave on top, the turn label and buttons under it.
          From tablet up: one row, Leave last.
        */}
        <div className="ml-auto flex flex-col items-end tablet:flex-row tablet:items-center md:gap-2">
          <div className="flex items-center tablet:hidden">
            <LanguageSwitch />
            <LeaveButton partnerName={partnerName} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!pausing && (
              <p
                role="status"
                className={cn(
                  'rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap',
                  myTurn
                    ? view.seat === 'pilot'
                      ? 'bg-pilot text-white'
                      : 'bg-copilot text-white'
                    : 'bg-muted',
                )}
              >
                {turnText(view, partnerName)}
              </p>
            )}
            {/* Dice are rolled: silence until the round ends, as at the table. */}
            {view.phase === 'placing' && (
              <p className="rounded-full bg-danger px-3 py-1 text-sm font-semibold whitespace-nowrap text-white">
                {t('status.noTalking')}
              </p>
            )}
            {view.phase === 'placing' && <RoundCountdown />}
            {view.phase === 'strategy' && <NextTurnCountdown />}
            <div className="hidden items-center tablet:flex">
              <LanguageSwitch />
              <LeaveButton partnerName={partnerName} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
