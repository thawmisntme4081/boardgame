import { canPlaceInView, SLOTS, type PlayerView, type SlotId } from '@sky/shared';
import { placeSelected } from '@/api';
import { cn } from '@/lib/utils';
import { useGame } from '@/store';
import { DieFace } from '@/svgs/DieFace';

const GROUP_LABEL = {
  axis: 'Axis',
  engines: 'Engines',
  radio: 'Radio',
  gear: 'Landing gear',
  flaps: 'Flaps',
  brakes: 'Brakes',
  concentration: 'Concentration',
} as const;

function slotLabel(slot: SlotId): string {
  const def = SLOTS[slot];
  const who = def.seats.length === 2 ? 'either player' : def.seats[0];
  const values = def.values ? `, needs ${def.values.join(' or ')}` : '';
  return `${GROUP_LABEL[def.group]} ${def.index + 1} (${who}${values})`;
}

/** A space on the control panel: shows its die, or lights up when the selected die fits. */
export function Slot({ slot, view }: { slot: SlotId; view: PlayerView }) {
  const selectedDieId = useGame((s) => s.selectedDieId);
  const coffeeDelta = useGame((s) => s.coffeeDelta);
  const def = SLOTS[slot];
  const placed = view.placed[slot];
  const valid =
    selectedDieId !== null && canPlaceInView(view, { dieId: selectedDieId, slot, coffeeDelta }).ok;
  const both = def.seats.length === 2;
  const seat = def.seats[0]!;

  return (
    <button
      type="button"
      aria-label={placed ? `${slotLabel(slot)}: ${placed.value}` : slotLabel(slot)}
      data-valid={valid || undefined}
      disabled={!valid}
      onClick={() => void placeSelected(slot)}
      className={cn(
        'relative grid size-12 shrink-0 place-items-center rounded-xl border-2 text-xs font-semibold transition',
        both
          ? 'border-dashed border-muted-foreground/50 bg-muted'
          : seat === 'pilot'
            ? 'border-pilot/60 bg-pilot-soft text-pilot'
            : 'border-copilot/70 bg-copilot-soft text-copilot',
        selectedDieId && !valid && !placed && 'opacity-40',
        valid && 'animate-pulse ring-4 ring-light-on ring-offset-1',
      )}
    >
      {placed ? (
        <DieFace value={placed.value} seat={placed.seat} className="size-10" />
      ) : (
        <span>{def.values?.join('·') ?? ''}</span>
      )}
    </button>
  );
}
