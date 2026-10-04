import type { DieValue, Seat } from '@sky/shared';
import { cn } from '@/lib/utils';
import { DieFace } from '@/svgs/DieFace';

/** The look of the die (or Intern token) in hand: lifted, with a dark ring. */
export const SELECTED_DIE = '-translate-y-1 ring-4 ring-foreground';

/** A die in the tray, as a toggle button; `className` sets its state (selected, dimmed). */
export function DieButton({
  value,
  seat,
  kind,
  label,
  pressed,
  disabled,
  onClick,
  className,
}: {
  value: DieValue;
  seat: Seat;
  kind?: 'traffic';
  label: string;
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn('rounded-xl p-0.5 transition', className)}
    >
      <DieFace value={value} seat={seat} kind={kind} className="size-11" />
    </button>
  );
}
