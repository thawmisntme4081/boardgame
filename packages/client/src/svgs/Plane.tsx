/** A small airplane glyph, centred on (x, y), for use inside another SVG. */
export function Plane({ x, y }: { x: number; y: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(0.9)`}
      d="M0 -7 L1.6 -2 L8 1 L8 3 L1.6 1.5 L1 5.5 L3.5 7 L3.5 8 L0 7 L-3.5 8 L-3.5 7 L-1 5.5 L-1.6 1.5 L-8 3 L-8 1 L-1.6 -2 Z"
      className="fill-plane"
    />
  );
}
