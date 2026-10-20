// Pandemic's part of the site header: who else is online, and leaving the game. The language and
// the account are the site's own.
import type { SeatId, TableView } from '@pandemic/rules';
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
import type { SeatPresence } from '@platform/ui/game';
import { seatInfo } from '@platform/ui/game';
import { cn } from '@platform/ui/utils';
import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { seatName } from '../lib/names';
import { platform } from '../platform';

/** A player's name with an online / offline dot, like Sky Team's status bar. */
function PlayerStatus({ presence, seat }: { presence: SeatPresence | null; seat: SeatId }) {
  const { t } = useTranslation('pandemic');
  const info = seatInfo(presence, seat);
  const name = seatName(presence, seat);
  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
      <span
        className={cn(
          'inline-block size-2 shrink-0 rounded-full',
          info?.online ? 'bg-light-on' : 'bg-danger',
        )}
        aria-hidden="true"
      />
      <span className="truncate">
        {info?.online ? t('status.playerOnline', { name }) : t('status.playerOffline', { name })}
      </span>
    </span>
  );
}

/** Gives up your seat, after a confirmation; whoever stays plays on with the seat open. */
function LeaveButton() {
  const { t } = useTranslation('pandemic');
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-danger hover:text-white"
          aria-label={t('leave.button')}
        >
          <LogOut />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('leave.title')}</DialogTitle>
          <DialogDescription>{t('leave.body')}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="h-11">
              {t('leave.stay')}
            </Button>
          </DialogClose>
          <Button variant="destructive" className="h-11" onClick={() => void platform().leave()}>
            {t('common.leave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function HeaderExtra({
  view,
  presence,
}: {
  view: TableView;
  presence: SeatPresence | null;
}) {
  const others = 'seats' in view ? view.seats.filter((seat) => seat !== view.you) : [];
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3">
        {others.map((seat) => (
          <PlayerStatus key={seat} presence={presence} seat={seat} />
        ))}
      </div>
      <LeaveButton />
    </>
  );
}
