import { useLayoutEffect, useRef, type ReactNode } from 'react';

const at = (x: number, y: number) => `translate(${x}px, ${y}px)`;

/** How a marker turns on its way: a disc rolls once, a diamond flips like a coin (twice). */
const TURNS: Record<'roll' | 'flip', Keyframe[]> = {
  roll: [
    { transform: 'rotate(0deg) scale(1)' },
    { transform: 'rotate(360deg) scale(1)', offset: 0.85 },
    { transform: 'rotate(360deg) scale(1.28)', offset: 0.93 },
    { transform: 'rotate(360deg) scale(1)' },
  ],
  flip: [
    { transform: 'scale(1, 1)' },
    { transform: 'scale(-1, 1)', offset: 0.28 },
    { transform: 'scale(1, 1)', offset: 0.56 },
    { transform: 'scale(-1, 1)', offset: 0.78 },
    { transform: 'scale(1, 1.0)', offset: 0.88 },
    { transform: 'scale(1.28, 1.28)', offset: 0.94 },
    { transform: 'scale(1, 1)' },
  ],
};

/**
 * A marker centered at (`x`, `y`) of the map that moves there in a straight line when `x` or `y`
 * change, turning as it goes (see `TURNS`) and pulsing when it lands. It is the same piece of the
 * page between moves, so its move is not cut short by a redraw.
 */
export function MovingMarker({
  x,
  y,
  turn,
  children,
}: {
  x: number;
  y: number;
  turn: 'roll' | 'flip';
  children: ReactNode;
}) {
  const outer = useRef<SVGGElement>(null);
  const inner = useRef<SVGGElement>(null);
  const before = useRef<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const prev = before.current;
    before.current = { x, y };
    if (!prev || (prev.x === x && prev.y === y)) return;
    const distance = Math.hypot(x - prev.x, y - prev.y);
    const duration = 700 + Math.min(500, distance * 4);
    outer.current?.animate([{ transform: at(prev.x, prev.y) }, { transform: at(x, y) }], {
      duration,
      easing: 'ease-in-out',
    });
    inner.current?.animate(TURNS[turn], { duration, easing: 'ease-in-out' });
  }, [x, y, turn]);

  return (
    <g ref={outer} style={{ transform: at(x, y) }}>
      <g ref={inner}>{children}</g>
    </g>
  );
}
