// The end of a game, the same in every game: a colored band (green for a win, red for a loss)
// with an icon, a title and a line, the game's details below, "View board" to look at the final
// board, and a bar at the bottom of the screen to bring the result back. The game gives the
// texts, the details and its own rematch buttons; this component only draws the frame.
import { Eye, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './components/dialog';
import { cn } from './utils';

/** A yellow note, shaped like a list of reasons: where a rematch offer stands. */
export function OfferNote({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
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

export function GameOverFrame({
  over,
  won,
  icon: Icon,
  title,
  description,
  hidden,
  onHideResult,
  onShowResult,
  viewBoardLabel,
  showResultLabel,
  extras,
  children,
}: {
  /** The game is over: the dialog (or its bar) shows. */
  over: boolean;
  won: boolean;
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  /** The result is hidden to look at the board: only the bar shows. */
  hidden: boolean;
  onHideResult: () => void;
  onShowResult: () => void;
  viewBoardLabel: string;
  showResultLabel: string;
  /** More buttons next to "View board" (a game's history, for instance). */
  extras?: ReactNode;
  /** The details of the result, and the rematch buttons. */
  children: ReactNode;
}) {
  const band = won ? 'bg-emerald-600' : 'bg-red-600';
  return (
    <>
      {over && hidden && (
        <div
          role="status"
          className={cn(
            'fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-3 text-white shadow-lg',
            band,
          )}
        >
          <Icon aria-hidden="true" className="size-6 shrink-0" />
          <span className="min-w-0 flex-1 font-semibold">{title}</span>
          <Button variant="secondary" className="h-11" onClick={onShowResult}>
            {showResultLabel}
          </Button>
        </div>
      )}
      <Dialog open={over && !hidden}>
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className={cn(
            'max-h-[90dvh] gap-0 overflow-y-auto p-0 ring-2 desktop:max-w-lg!',
            won ? 'ring-emerald-600' : 'ring-red-600',
          )}
        >
          <DialogHeader className={cn('flex-row items-center gap-3 px-4 py-4 text-white', band)}>
            <Icon aria-hidden="true" className="size-10 shrink-0" />
            <div className="flex min-w-0 flex-col gap-0.5 text-left">
              <DialogTitle className="text-2xl font-bold text-white">{title}</DialogTitle>
              <DialogDescription className="text-white/90">{description}</DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-4 p-4">
            {children}
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="ghost" className="h-11" onClick={onHideResult}>
                <Eye /> {viewBoardLabel}
              </Button>
              {extras}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
