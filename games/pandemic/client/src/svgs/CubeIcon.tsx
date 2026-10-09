import type { Color } from '@pandemic/rules';
import type { SVGProps } from 'react';

export interface CubeIconProps extends SVGProps<SVGSVGElement> {
  color: Color;
}

/**
 * A still disease cube seen from an angle (light top, mid left face, dark right face), for
 * counters and lists. The cubes on the map are the turning `Cube`. Draw it inside an <svg>.
 */
export function CubeIcon({ color, ...props }: CubeIconProps) {
  const base = `var(--color-disease-${color})`;
  return (
    <svg viewBox="0 0 20 22" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M10 1 19 6 10 11 1 6Z" fill={`color-mix(in oklch, ${base}, white 40%)`} />
      <path d="M1 6 10 11V21L1 16Z" fill={base} />
      <path d="M19 6 10 11V21L19 16Z" fill={`color-mix(in oklch, ${base}, black 35%)`} />
    </svg>
  );
}
