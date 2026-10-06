import type { CSSProperties } from 'react';
import { cn } from '@platform/ui/utils';

/** The red brake marker under the speed gauge; draw it inside an <svg> (the gauge moves it). */
export function BrakeMarker({ style, className }: { style?: CSSProperties; className?: string }) {
  return (
    <g style={style} className={cn('fill-danger', className)}>
      <path d="M 0 58 l -6 12 h 12 z" />
    </g>
  );
}

/** The same marker on its own, e.g. inline in text. */
export function BrakeMarkerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="-6 58 12 12" aria-hidden="true" className={cn('inline-block size-3', className)}>
      <BrakeMarker />
    </svg>
  );
}
