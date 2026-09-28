import type { PlayerView } from '@sky/shared';
import { leaveGame, rematch } from '@/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { endReasonText } from '@/messages';

export function GameOverDialog({ view }: { view: PlayerView }) {
  const over = view.phase === 'won' || view.phase === 'lost';
  const won = view.phase === 'won';
  const reasons = view.landingFailures ?? (view.endReason ? [view.endReason] : []);

  return (
    <Dialog open={over}>
      <DialogContent showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{won ? 'Smooth landing!' : 'The plane went down'}</DialogTitle>
          <DialogDescription>
            {won
              ? 'The passengers burst into applause. You landed the plane together.'
              : `Round ${view.round}, ${view.altitude.toLocaleString()} ft.`}
          </DialogDescription>
        </DialogHeader>
        {!won && (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {reasons.map((reason) => (
              <li key={reason}>{endReasonText[reason]}</li>
            ))}
          </ul>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-11" onClick={() => void leaveGame()}>
            Leave
          </Button>
          <Button className="h-11" onClick={() => void rematch()}>
            Fly again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
