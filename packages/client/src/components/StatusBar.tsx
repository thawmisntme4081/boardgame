import { otherSeat, type PlayerView, type Presence } from '@sky/shared';
import { LogOut, WifiOff } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { seatName } from '@/messages';
import { NextTurnCountdown } from './NextTurnCountdown';
import { RoundCountdown } from './RoundCountdown';
import { useNow } from '@/lib/useNow';
import { useGame, type Connection } from '@/store';

function turnText(view: PlayerView, partner: string): string {
  switch (view.phase) {
    case 'strategy':
      return 'Strategy time';
    case 'placing':
      return view.currentSeat === view.seat ? 'Your turn' : `${partner}’s turn`;
    case 'won':
      return 'Landed!';
    case 'lost':
      return 'Crashed';
  }
}

/** Gives up your seat, after a confirmation; your partner's game restarts. */
function LeaveButton({ partnerName }: { partnerName: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 hover:bg-danger hover:text-white"
          aria-label="Leave game"
        >
          <LogOut />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave this game?</DialogTitle>
          <DialogDescription>
            Your seat is given up and {partnerName}’s game restarts, waiting for a new partner. To
            pause instead, just close the tab: your seat is kept for 30 minutes.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="h-11">
              Stay
            </Button>
          </DialogClose>
          <Button variant="destructive" className="h-11" onClick={() => void leaveGame()}>
            Leave game
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
  const partnerSeat = otherSeat(view.seat);
  const partner = presence?.[partnerSeat];
  const partnerName = partner?.name ?? seatName[partnerSeat];
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
          {connection === 'connecting' ? 'Reconnecting…' : 'Offline'}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold tabular-nums">
              Round {view.round}/{view.scenario.altitudes.length} · {view.altitude.toLocaleString()}{' '}
              ft
              {view.finalRound && (
                <span className="ml-2 rounded bg-danger px-1.5 py-0.5 text-xs text-white">
                  Final
                </span>
              )}
            </p>
            <p className="flex flex-col text-xs text-muted-foreground tablet:flex-row tablet:gap-1">
              <span className="truncate">
                You are the{' '}
                <span className={view.seat === 'pilot' ? 'text-pilot' : 'text-copilot'}>
                  {seatName[view.seat]}
                </span>
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
                {partnerName} {partner?.online ? 'online' : 'offline'}
              </span>
            </p>
          </div>
        </div>
        {/*
          The right box. Phones: Leave on top, the turn label and buttons under it.
          From tablet up: one row, Leave last.
        */}
        <div className="ml-auto flex flex-col items-end tablet:flex-row tablet:items-center md:gap-2">
          <div className="tablet:hidden">
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
                No talking
              </p>
            )}
            {view.phase === 'placing' && <RoundCountdown />}
            {view.phase === 'strategy' && <NextTurnCountdown />}
            <div className="hidden tablet:block">
              <LeaveButton partnerName={partnerName} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
