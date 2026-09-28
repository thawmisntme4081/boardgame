import { brakeThreshold, type PlayerView } from '@sky/shared';

const SPEED_MIN = 2;
const SPEED_MAX = 12;
const speedX = (v: number) => 16 + (v - SPEED_MIN) * 22;

/** Speed gauge: the aerodynamics markers set how far a speed moves the plane; brakes below. */
export function SpeedGauge({ view }: { view: PlayerView }) {
  const blue = view.aeroBlue + 0.5;
  const orange = view.aeroOrange + 0.5;
  const brake = brakeThreshold(view.brakes) + 0.5;
  const ticks = [];
  for (let v = SPEED_MIN; v <= SPEED_MAX; v++) ticks.push(v);

  return (
    <svg
      viewBox="0 0 256 84"
      className="w-full max-w-72"
      role="img"
      aria-label={`Speed ${view.speed ?? 'not set'}. Below ${Math.ceil(blue)}: stay; up to ${Math.floor(orange)}: 1 space; above: 2 spaces. Brakes stop speeds up to ${Math.floor(brake)}.`}
    >
      <rect
        x={speedX(SPEED_MIN - 0.5)}
        y="20"
        width={speedX(blue) - speedX(SPEED_MIN - 0.5)}
        height="16"
        className="fill-muted"
      />
      <rect
        x={speedX(blue)}
        y="20"
        width={speedX(orange) - speedX(blue)}
        height="16"
        className="fill-pilot-soft"
      />
      <rect
        x={speedX(orange)}
        y="20"
        width={Math.max(0, speedX(SPEED_MAX + 0.5) - speedX(orange))}
        height="16"
        className="fill-copilot-soft"
      />
      <text
        x={(speedX(SPEED_MIN - 0.5) + speedX(blue)) / 2}
        y="32"
        textAnchor="middle"
        className="fill-muted-foreground text-[10px]"
      >
        0
      </text>
      <text
        x={(speedX(blue) + speedX(orange)) / 2}
        y="32"
        textAnchor="middle"
        className="fill-muted-foreground text-[10px]"
      >
        +1
      </text>
      {orange < SPEED_MAX && (
        <text
          x={(speedX(orange) + speedX(SPEED_MAX + 0.5)) / 2}
          y="32"
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          +2
        </text>
      )}
      {ticks.map((v) => (
        <text
          key={v}
          x={speedX(v)}
          y="52"
          textAnchor="middle"
          className="fill-foreground text-[11px]"
        >
          {v}
        </text>
      ))}
      <path d={`M ${speedX(blue)} 18 l -6 -12 h 12 z`} className="fill-pilot" />
      <path
        d={`M ${speedX(Math.min(orange, SPEED_MAX + 0.5))} 18 l -6 -12 h 12 z`}
        className="fill-copilot"
      />
      <path d={`M ${speedX(brake)} 58 l -6 12 h 12 z`} className="fill-danger" />
      <text x={speedX(brake) + 9} y="80" className="fill-danger text-[10px]">
        brakes
      </text>
      {view.speed !== null && (
        <circle
          cx={speedX(Math.min(view.speed, SPEED_MAX))}
          cy="28"
          r="7"
          className="fill-foreground stroke-background"
          strokeWidth="2"
        >
          <title>{`Speed ${view.speed}`}</title>
        </circle>
      )}
    </svg>
  );
}
