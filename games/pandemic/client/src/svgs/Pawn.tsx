import type { SeatId } from '@pandemic/rules';
import type { SVGProps } from 'react';

export const PAWN_WIDTH = 22;
export const PAWN_HEIGHT = 37;

export interface PawnProps extends SVGProps<SVGSVGElement> {
  seat: SeatId;
}

const mix = (base: string, to: string, percent: number) =>
  `color-mix(in oklch, ${base}, ${to} ${percent}%)`;

/**
 * A player's pawn, in the seat's color, as a lit solid: a sphere head on a bell-shaped body with a
 * round foot and a soft shadow on the ground. The shape is traced from the Researcher's picture.
 * Draw it inside an <svg>.
 */
export function Pawn({ seat, children, ...props }: PawnProps) {
  const base = `var(--color-seat-${seat})`;
  const body = `pawn-body-${seat}`;
  const head = `pawn-head-${seat}`;
  return (
    <svg
      viewBox="15 5 34 57"
      xmlns="http://www.w3.org/2000/svg"
      width={PAWN_WIDTH}
      height={PAWN_HEIGHT}
      {...props}
    >
      <defs>
        <linearGradient id={body} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" style={{ stopColor: mix(base, 'white', 14) }} />
          <stop offset="0.35" style={{ stopColor: base }} />
          <stop offset="1" style={{ stopColor: mix(base, 'black', 25) }} />
        </linearGradient>
        <radialGradient id={head} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" style={{ stopColor: mix(base, 'white', 30) }} />
          <stop offset="0.45" style={{ stopColor: base }} />
          <stop offset="1" style={{ stopColor: mix(base, 'black', 25) }} />
        </radialGradient>
      </defs>
      <ellipse cx={34} cy={58.5} rx={15} ry={3} fill="black" fillOpacity={0.25} />
      <path
        d="M25 26C20 31 18 40 18 47C18 54 24 58 32 58C40 58 46 54 46 47C46 40 44 31 39 26Z"
        fill={`url(#${body})`}
      />
      <ellipse cx={32} cy={55.5} rx={13.5} ry={3.5} fill="black" fillOpacity={0.12} />
      <path
        d="M23 42C22 47 24 52 29 54"
        fill="none"
        stroke="white"
        strokeOpacity={0.15}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <path
        d="M26 27.5Q32 31 38 27.5"
        fill="none"
        stroke="black"
        strokeOpacity={0.3}
        strokeWidth={1.6}
      />
      <circle cx={32} cy={16.5} r={10.5} fill={`url(#${head})`} />
      <ellipse cx={28} cy={12} rx={3.5} ry={2.6} fill="white" fillOpacity={0.3} />
      {children}
    </svg>
  );
}
