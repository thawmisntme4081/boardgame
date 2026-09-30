import { SLOTS, type PlayerView, type SlotId } from '@sky/shared';
import { placeSelected } from '@/api';
import { slotValid } from '@/lib/moves';
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
  kerosene: 'Kerosene',
  intern: 'Intern',
  iceBrakes: 'Ice brakes',
} as const;

function slotLabel(slot: SlotId): string {
  const def = SLOTS[slot];
  const who = def.seats.length === 2 ? 'either player' : def.seats[0];
  const values = def.values ? `, needs ${def.values.join(' or ')}` : '';
  const row = def.group === 'iceBrakes' ? (slot.endsWith('Top') ? ' above' : ' below') : '';
  return `${GROUP_LABEL[def.group]} ${def.index + 1}${row} (${who}${values})`;
}

const SOURCE_LABEL = { intern: ' (intern token)', traffic: ' (traffic die)' } as const;

/** A space on the control panel: shows its die, or lights up when the selected die fits. */
export function Slot({ slot, view }: { slot: SlotId; view: PlayerView }) {
  const selectedDieId = useGame((s) => s.selectedDieId);
  const coffeeDelta = useGame((s) => s.coffeeDelta);
  const internSlot = useGame((s) => s.internSlot);
  const def = SLOTS[slot];
  const placed = view.placed[slot];
  const valid = slotValid(view, { selectedDieId, coffeeDelta, internSlot }, slot);
  const chosen = internSlot === slot;
  const both = def.seats.length === 2;
  const seat = def.seats[0]!;

  return (
    <button
      type="button"
      aria-label={
        placed
          ? `${slotLabel(slot)}: ${placed.value}${placed.source ? SOURCE_LABEL[placed.source] : ''}`
          : slotLabel(slot)
      }
      aria-pressed={chosen || undefined}
      data-valid={valid || undefined}
      disabled={!valid}
      onClick={() => void placeSelected(slot)}
      className={cn(
        'relative grid size-12 shrink-0 place-items-center rounded-xl border-2 text-xs font-semibold transition',
        both
          ? 'slot-shared'
          : seat === 'pilot'
            ? 'border-pilot/60 bg-pilot-soft text-pilot'
            : 'border-copilot/70 bg-copilot-soft text-copilot',
        selectedDieId && !valid && !placed && !chosen && 'opacity-40',
        valid && 'animate-pulse ring-4 ring-light-on ring-offset-1',
        chosen && 'ring-4 ring-foreground ring-offset-1',
      )}
    >
      {placed ? (
        <DieFace value={placed.value} seat={placed.seat} kind={placed.source} className="size-10" />
      ) : (
        <span>{def.values?.join('·') ?? ''}</span>
      )}
    </button>
  );
}
