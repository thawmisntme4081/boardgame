// Circle drawing helpers for the round SVG instruments. Angles in degrees: 0 = right, 90 = down.

const DEG = Math.PI / 180;

/** The point at `deg` degrees, `r` from a centre at (`c`, `c`). */
export const polar = (c: number, deg: number, r: number): [number, number] => [
  c + r * Math.cos(deg * DEG),
  c + r * Math.sin(deg * DEG),
];

/** An SVG path for the arc from `a0` to `a1` degrees, radius `r`, centre (`c`, `c`). */
export function arc(c: number, a0: number, a1: number, r: number): string {
  const [x0, y0] = polar(c, a0, r);
  const [x1, y1] = polar(c, a1, r);
  return `M ${x0} ${y0} A ${r} ${r} 0 0 ${a1 > a0 ? 1 : 0} ${x1} ${y1}`;
}
