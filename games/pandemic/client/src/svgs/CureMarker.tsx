import type { Color } from '@pandemic/rules';
import type { SVGProps } from 'react';

export const CURE_MARKER_WIDTH = 23;
export const CURE_MARKER_HEIGHT = 30.7;
export const CURE_MARKER_INSET = 1;

export interface CureMarkerProps extends SVGProps<SVGSVGElement> {
  color: Color;
  eradicated?: boolean;
}

export function CureMarker({ color, eradicated = false, ...props }: CureMarkerProps) {
  return (
    <svg
      viewBox="0 0 30 40"
      xmlns="http://www.w3.org/2000/svg"
      width={CURE_MARKER_WIDTH}
      height={CURE_MARKER_HEIGHT}
      {...props}
    >
      <g
        transform="matrix(1.3 0 0 1.3 -4.5 -9.5)"
        stroke={eradicated ? 'oklch(0.85 0.17 95)' : '#fff'}
      >
        <path
          d="M10 9h10c2 0 2 3 .2 4.5C24 15 25 17 25 20v12c0 3-1.5 4.5-5 4.5H10c-3.5 0-5-1.5-5-4.5V20c0-3 1-5 4.8-6.5C8 12 8 9 10 9Z"
          fill={`var(--color-disease-${color})`}
          strokeWidth={eradicated ? 1.5 : 0.75}
        />
        <circle cx={15} cy={24} r={6} fill="none" stroke="#fff" strokeWidth={1.12} />
        <path stroke="#fff" strokeWidth={1.12} d="m10.8 19.8 8.4 8.4" />
      </g>
    </svg>
  );
}
