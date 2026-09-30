import { SLOT_IDS, SLOTS, type PlayerView, type Presence } from '@sky/shared';
import { useEffect, useRef } from 'react';
import { Cockpit } from '@/components/Cockpit';
import { DiceTray } from '@/components/DiceTray';
import { GameOverDialog } from '@/components/GameOverDialog';
import { StatusBar } from '@/components/StatusBar';
import { placingValue, slotValid } from '@/lib/moves';
import { AltitudeTrack } from '@/svgs/AltitudeTrack';
import { ApproachTrack } from '@/svgs/ApproachTrack';
import { useGame } from '@/store';

/** The approach space the selected die (or intern token) would clear on the radio, if it can go there. */
function useRadioTarget(view: PlayerView): number | undefined {
  const selectedDieId = useGame((s) => s.selectedDieId);
  const coffeeDelta = useGame((s) => s.coffeeDelta);
  const internSlot = useGame((s) => s.internSlot);
  const selection = { selectedDieId, coffeeDelta, internSlot };
  const value = placingValue(view, selection);
  if (value === undefined) return undefined;
  const radioOk = SLOT_IDS.some(
    (slot) => SLOTS[slot].group === 'radio' && slotValid(view, selection, slot),
  );
  return radioOk ? view.approachIndex + value - 1 : undefined;
}

/** A short buzz on Android when it becomes your turn. */
function useTurnBuzz(view: PlayerView): void {
  const myTurn = view.phase === 'placing' && view.currentSeat === view.seat;
  const was = useRef(myTurn);
  useEffect(() => {
    if (myTurn && !was.current) navigator.vibrate?.(60);
    was.current = myTurn;
  }, [myTurn]);
}

export default function Game({ view, presence }: { view: PlayerView; presence: Presence | null }) {
  const connection = useGame((s) => s.connection);
  const radioTarget = useRadioTarget(view);
  useTurnBuzz(view);

  return (
    // On desktop the game sits in a centred container over a muted page.
    <div className="bg-muted">
      <div className="game-grid bg-background desktop:border-x desktop:shadow-sm">
        <div className="[grid-area:status]">
          <StatusBar view={view} presence={presence} connection={connection} />
        </div>

        {/* Side by side on phones (compact strip) and desktop, stacked on tablets. */}
        <div className="grid content-start gap-3 border-b bg-background px-4 py-2 [grid-area:tracks] tablet:grid-cols-1 tablet:py-3 desktop:grid-cols-[repeat(2,minmax(0,24rem))] desktop:justify-center desktop:gap-x-10">
          <AltitudeTrack view={view} />
          <ApproachTrack view={view} radioTarget={radioTarget} />
        </div>

        <main className="min-h-0 overflow-y-auto bg-muted/40 p-3 [grid-area:cockpit]">
          <Cockpit view={view} />
        </main>

        <section
          aria-label="Your dice"
          className="border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [grid-area:tray] tablet:border-t-0 tablet:border-l desktop:border-t desktop:border-l-0"
        >
          <DiceTray view={view} presence={presence} />
        </section>

        <GameOverDialog view={view} />
      </div>
    </div>
  );
}
