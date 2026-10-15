import type { PlayerView, Presence } from '@sky/rules';
import { LogOut, WifiOff } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { leaveGame } from '../api';
import { Button } from '@platform/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@platform/ui/components/dialog';
import { formatNumber } from '../i18n';
import { SEAT_STYLE } from '../lib/seatStyle';
import { useNextTurnLeft } from '../lib/useNextTurn';
import { DIFFICULTY_BADGE, difficultyLevel } from '../scenarioText';
import { cn } from '@platform/ui/utils';
import { seatName } from '../messages';
import { partnerOf } from '../partner';
import type { Connection } from '@platform/ui/game';
import { LanguageSwitch } from '@platform/ui/LanguageSwitch';
import { NextTurnCountdown } from './NextTurnCountdown';
import { RoundCountdown } from './RoundCountdown';

/** Whose turn it is (or the game's phase); in your seat's color while you place. */
function TurnPill({ view, partnerName }: { view: PlayerView; partnerName: string }) {
  const { t } = useTranslation('sky-team');
  const myTurn = view.phase === 'placing' && view.currentSeat === view.seat;
  const text = {
    setup: () => t('preflight.title'),
    strategy: () => (view.autoRoll ? t('status.totalTrust') : t('status.strategy')),
    placing: () =>
      myTurn ? t('status.yourTurn') : t('status.partnersTurn', { name: partnerName }),
    won: () => t('status.landed'),
    lost: () => t('status.crashed'),
  }[view.phase]();
  return (
    <p
      role="status"
      className={cn(
        'rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap',
        myTurn ? SEAT_STYLE[view.seat].pill : 'bg-muted',
      )}
    >
      {text}
    </p>
  );
}

/** Gives up your seat, after a confirmation; your partner's game restarts. */
function LeaveButton({ partnerName }: { partnerName: string }) {
  const { t } = useTranslation('sky-team');
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
  const { t } = useTranslation('sky-team');
  const { info: partner, name: partnerName } = partnerOf(view, presence);
  // During the green "Next turn in 5s" pause, that countdown is the only pill.
  const pauseLeft = useNextTurnLeft();
  const pausing = view.phase === 'strategy' && pauseLeft !== null;

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
            <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold tabular-nums">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
                  DIFFICULTY_BADGE[view.scenario.difficulty],
                )}
              >
                {t('status.difficulty', {
                  level: difficultyLevel(view.scenario.difficulty),
                })}
              </span>
              <p>
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
            </div>
            <p className="flex flex-col text-xs text-muted-foreground tablet:flex-row tablet:gap-1">
              <span className="truncate">
                <Trans
                  ns="sky-team"
                  i18nKey="status.youAre"
                  values={{ seat: seatName(view.seat) }}
                  components={{ seat: <span className={SEAT_STYLE[view.seat].text} /> }}
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
            {!pausing && <TurnPill view={view} partnerName={partnerName} />}
            {/* Dice are rolled (or Total Trust): silence until the round ends, as at the table. */}
            {(view.phase === 'placing' ||
              (view.autoRoll && view.phase === 'strategy' && !pausing)) && (
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
