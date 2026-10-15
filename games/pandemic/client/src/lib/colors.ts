import type { Color } from '@pandemic/rules';
import type { CSSProperties } from 'react';

/**
 * A pale version of a disease color, for buttons and badges: the color mixed with white, a
 * border in the full color, and dark text (`DISEASE_PALE_TEXT`) that reads on all four.
 */
export const diseasePale = (color: Color): CSSProperties => ({
  background: `color-mix(in oklch, var(--color-disease-${color}), white 72%)`,
  borderColor: `color-mix(in oklch, var(--color-disease-${color}), white 25%)`,
});

export const DISEASE_PALE_TEXT = 'text-foreground';
