import type { SVGProps } from 'react';

const GREEN = '#1fa34a';

function body(inset: number): string {
  const a = inset;
  const b = 32 - inset;
  const r = 3.2; // corner rounding
  const bow = 4.6; // how far each side bows inward
  return (
    `M${a + r} ${a}Q16 ${a + bow} ${b - r} ${a}Q${b} ${a} ${b} ${a + r}` +
    `Q${b - bow} 16 ${b} ${b - r}Q${b} ${b} ${b - r} ${b}` +
    `Q16 ${b - bow} ${a + r} ${b}Q${a} ${b} ${a} ${b - r}` +
    `Q${a + bow} 16 ${a} ${a + r}Q${a} ${a} ${a + r} ${a}Z`
  );
}

function arrow(sx: number, sy: number): { shaft: string; head: string } {
  const p = (along: number, across = 0) => {
    const ux = sx / Math.SQRT2;
    const uy = sy / Math.SQRT2;
    return `${(16 + ux * along - uy * across).toFixed(2)} ${(16 + uy * along + ux * across).toFixed(2)}`;
  };
  return {
    shaft: `M${p(5.4)}L${p(9)}`,
    head: `M${p(12.6)}L${p(8, 3.4)}L${p(8, -3.4)}Z`,
  };
}

export function OutbreakMarker(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g transform="translate(16 16) rotate(45) scale(0.71) translate(-16 -16)">
        <path d={body(0.6)} fill={GREEN} />
        <path d={body(1.5)} fill="none" stroke="white" strokeWidth={1.5} />
        <circle cx={16} cy={16} r={3.2} fill="none" stroke="white" strokeWidth={2} />
        {[
          [1, -1],
          [-1, -1],
          [1, 1],
          [-1, 1],
        ].map(([sx = 1, sy = 1]) => {
          const { shaft, head } = arrow(sx, sy);
          return (
            <g key={`${sx}${sy}`} fill="white" stroke="white" strokeLinejoin="round">
              <path d={shaft} strokeWidth={3.1} strokeLinecap="round" />
              <path d={head} strokeWidth={0.85} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
