import type { DieValue, PlacedDie, Seat } from '@sky/rules';
import { cn } from '@platform/ui/utils';

const PIPS: Record<DieValue, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 26],
    [72, 26],
    [28, 50],
    [72, 50],
    [28, 74],
    [72, 74],
  ],
};

interface DieFaceProps {
  value: DieValue;
  seat: Seat;
  /** The black traffic die (Synchronization) or an Intern token, instead of a player's die. */
  kind?: PlacedDie['source'];
  className?: string;
}

/** A die face (or Intern token) as SVG, so it stays sharp at any size. */
export function DieFace({ value, seat, kind, className }: DieFaceProps) {
  if (kind === 'intern') {
    return (
      <svg viewBox="0 0 100 100" className={cn('block', className)} aria-hidden="true">
        <rect
          x="8"
          y="8"
          width="84"
          height="84"
          rx="14"
          strokeWidth="8"
          className="fill-card stroke-emerald-500"
        />
        <text x="50" y="68" textAnchor="middle" className="fill-foreground text-[52px] font-bold">
          {value}
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" className={cn('block', className)} aria-hidden="true">
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="18"
        className={
          kind === 'traffic' ? 'fill-neutral-900' : seat === 'pilot' ? 'fill-pilot' : 'fill-copilot'
        }
      />
      {PIPS[value].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="9" className="fill-white" />
      ))}
    </svg>
  );
}
