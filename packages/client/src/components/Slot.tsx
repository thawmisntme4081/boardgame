import { SLOTS, type PlayerView, type SlotId } from '@sky/shared';
import { useTranslation } from 'react-i18next';
import { placeSelected } from '@/api';
import { t } from '@/i18n';
import { slotValid } from '@/lib/moves';
import { cn } from '@/lib/utils';
import { useGame } from '@/store';
import { DieFace } from '@/svgs/DieFace';

/** "Landing gear 2 (pilot, needs 3 or 4)": what the space is, whose it is, what it takes. */
function slotLabel(slot: SlotId): string {
  const def = SLOTS[slot];
  const who =
    def.seats.length === 2
      ? t('seat.either')
      : def.seats[0] === 'pilot'
        ? t('seat.pilotLower')
        : t('seat.copilotLower');
  const needs = def.values ? t('slot.needs', { values: def.values.join(t('slot.or')) }) : '';
  const row =
    def.group === 'iceBrakes' ? (slot.endsWith('Top') ? t('slot.above') : t('slot.below')) : '';
  return t('slot.label', {
    group: t(`slot.group.${def.group}`),
    n: def.index + 1,
    row,
    who,
    needs,
  });
}

const SOURCE_KEY = { intern: 'slot.internToken', traffic: 'slot.trafficDie' } as const;

/** A space on the control panel: shows its die, or lights up when the selected die fits. */
export function Slot({ slot, view }: { slot: SlotId; view: PlayerView }) {
  useTranslation(); // re-render when the language changes
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
          ? t('slot.placed', { label: slotLabel(slot), value: placed.value }) +
            (placed.source ? t(SOURCE_KEY[placed.source]) : '')
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
