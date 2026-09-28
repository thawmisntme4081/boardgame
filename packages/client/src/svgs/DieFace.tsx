import type { DieValue, Seat } from '@sky/shared';
import { cn } from '@/lib/utils';

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
  className?: string;
}

/** A die face as SVG, so it stays sharp at any size. */
export function DieFace({ value, seat, className }: DieFaceProps) {
  return (
    <svg viewBox="0 0 100 100" className={cn('block', className)} aria-hidden="true">
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="18"
        className={seat === 'pilot' ? 'fill-pilot' : 'fill-copilot'}
      />
      {PIPS[value].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="9" className="fill-white" />
      ))}
    </svg>
  );
}
