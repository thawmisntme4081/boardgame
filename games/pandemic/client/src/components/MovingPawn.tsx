import type { SeatId } from '@pandemic/rules';
import { useLayoutEffect, useRef } from 'react';
import { Pawn } from '../svgs/Pawn';

/** Time of a hop between two cities (longer for a longer way), and of a slide in a stack. */
const HOP_MS = { base: 500, perPixel: 1.2, max: 1200 };
const SLIDE_MS = 350;

const at = (x: number, y: number) => `translate(${x}px, ${y}px)`;

/**
 * A pawn standing at (`x`, `y`) of the map, which moves there in a straight line when `x` or `y`
 * change (a city change takes longer than a slide within the same city's stack). It keeps its
 * place in the page between moves, so the same pawn is moved, not drawn again.
 */
export function MovingPawn({
  seat,
  city,
  x,
  y,
  name,
}: {
  seat: SeatId;
  city: string;
  x: number;
  y: number;
  name: string;
}) {
  const group = useRef<SVGGElement>(null);
  const before = useRef<{ x: number; y: number; city: string } | null>(null);

  useLayoutEffect(() => {
    const prev = before.current;
    before.current = { x, y, city };
    if (!prev || (prev.x === x && prev.y === y)) return;
    const hop = prev.city !== city;
    const distance = Math.hypot(x - prev.x, y - prev.y);
    group.current?.animate([{ transform: at(prev.x, prev.y) }, { transform: at(x, y) }], {
      duration: hop ? Math.min(HOP_MS.max, HOP_MS.base + distance * HOP_MS.perPixel) : SLIDE_MS,
      easing: 'ease-in-out',
    });
  }, [x, y, city]);

  return (
    <g ref={group} style={{ transform: at(x, y) }}>
      <Pawn data-pawn={seat} seat={seat} x={0} y={0}>
        <title>{name}</title>
      </Pawn>
    </g>
  );
}
