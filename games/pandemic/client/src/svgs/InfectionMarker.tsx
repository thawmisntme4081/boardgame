import { useId, type SVGProps } from 'react';

const GREEN = '#1fa34a';
const BLADES = [-90, 30, 150];
/** The standard biohazard proportions, in units of `A` (the whole symbol is about 52 A wide). */
const A = 0.46;
const at = (distance: number, deg: number) => ({
  cx: 16 + distance * A * Math.cos((deg * Math.PI) / 180),
  cy: 16 + distance * A * Math.sin((deg * Math.PI) / 180),
});

export function InfectionMarker(props: SVGProps<SVGSVGElement>) {
  const cut = useId();
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <mask id={cut} maskUnits="userSpaceOnUse" x={0} y={0} width={30} height={32}>
          <rect width={32} height={32} fill="white" />
          {BLADES.map((deg) => (
            <circle key={deg} {...at(18, deg)} r={10 * A} fill="black" />
          ))}
          <circle cx={16} cy={16} r={3 * A} fill="black" />
          {/* The thin lines that part the blades in the middle. */}
          {BLADES.map((deg) => (
            <line
              key={`gap-${deg}`}
              x1={16}
              y1={16}
              {...(({ cx, cy }) => ({ x2: cx, y2: cy }))(at(7, deg + 180))}
              stroke="black"
              strokeWidth={A}
            />
          ))}
        </mask>
      </defs>
      <circle cx={16} cy={16} r={15.5} fill={GREEN} />
      <circle cx={16} cy={16} r={14.2} fill="none" stroke="white" strokeWidth={1.2} />
      <g fill="white" mask={`url(#${cut})`}>
        {BLADES.map((deg) => (
          <circle key={deg} {...at(12, deg)} r={15 * A} />
        ))}
        <circle cx={16} cy={16} r={12.5 * A} fill="none" stroke="white" strokeWidth={3 * A} />
      </g>
    </svg>
  );
}
