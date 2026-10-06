import type { CSSProperties } from 'react';
import { cn } from '@platform/ui/utils';

type Marker = 'blue' | 'orange';

/**
 * An Aerodynamics marker above the speed gauge: blue (moved by the landing gear) or orange
 * (moved by the flaps). Draw it inside an <svg> (the gauge moves it).
 */
export function AeroMarker({
  marker,
  style,
  className,
}: {
  marker: Marker;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <path
      d="M 0 18 l -6 -12 h 12 z"
      style={style}
      className={cn(marker === 'blue' ? 'fill-pilot' : 'fill-copilot', className)}
    />
  );
}

/** The same marker on its own, e.g. inline in text. */
export function AeroMarkerIcon({ marker, className }: { marker: Marker; className?: string }) {
  return (
    <svg viewBox="-6 6 12 12" aria-hidden="true" className={cn('inline-block size-3', className)}>
      <AeroMarker marker={marker} />
    </svg>
  );
}
