import { otherSeat, type PlayerView, type Presence } from '@sky/shared';
import { WifiOff } from 'lucide-react';
import { ready } from '@/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { seatName } from '@/messages';
import type { Connection } from '@/store';

function turnText(view: PlayerView, partner: string): string {
  switch (view.phase) {
    case 'strategy':
      return 'Strategy: talk it over';
    case 'placing':
      return view.currentSeat === view.seat ? 'Your turn' : `${partner}’s turn`;
    case 'won':
      return 'Landed!';
    case 'lost':
      return 'Crashed';
  }
}

/** Ends your strategy discussion; the dice roll once both players are ready. */
function ReadyButton({ ready: isReady, partnerName }: { ready: boolean; partnerName: string }) {
  return (
    <Button
      className="h-11"
      variant={isReady ? 'outline' : 'default'}
      disabled={isReady}
      onClick={() => void ready()}
    >
      {isReady ? `Waiting for ${partnerName}…` : 'Ready to roll'}
    </Button>
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
        <div className="min-w-0">
          <p className="text-sm font-semibold tabular-nums">
            Round {view.round}/{view.scenario.altitudes.length} · {view.altitude.toLocaleString()}{' '}
            ft
            {view.finalRound && (
              <span className="ml-2 rounded bg-danger px-1.5 py-0.5 text-xs text-white">Final</span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            You are the{' '}
            <span className={view.seat === 'pilot' ? 'text-pilot' : 'text-copilot'}>
              {seatName[view.seat]}
            </span>
            {' · '}
            <span className="inline-flex items-center gap-1">
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
        <div className="ml-auto flex items-center gap-2">
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
          {view.phase === 'strategy' && (
            <ReadyButton ready={presence?.[view.seat]?.ready ?? false} partnerName={partnerName} />
          )}
        </div>
      </div>
    </header>
  );
}
