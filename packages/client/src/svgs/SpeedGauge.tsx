import { brakeThreshold, type PlayerView } from '@sky/shared';
import { cn } from '@/lib/utils';

const SPEED_MIN = 2;
const SPEED_MAX = 12;
const speedX = (v: number) => 16 + (v - SPEED_MIN) * 22;
const LEFT = speedX(SPEED_MIN - 0.5);
const RIGHT = speedX(SPEED_MAX + 0.5);

const SLIDE = 'transition-[transform,opacity] duration-500 ease-out motion-reduce:transition-none';
const at = (x: number) => ({ transform: `translateX(${x}px)` });
/** A band from x1 to x2: a 1-unit rect stretched from the origin. */
const span = (x1: number, x2: number) => ({
  transform: `translateX(${x1}px) scaleX(${Math.max(0, x2 - x1)})`,
  transformOrigin: '0 0',
});

export function SpeedGauge({ view, className }: { view: PlayerView; className?: string }) {
  const blue = speedX(view.aeroBlue + 0.5);
  const orange = speedX(Math.min(view.aeroOrange + 0.5, SPEED_MAX + 0.5));
  const brake = brakeThreshold(view.brakes) + 0.5;
  const ticks = [];
  for (let v = SPEED_MIN; v <= SPEED_MAX; v++) ticks.push(v);
  const speedDot = speedX(view.speed === null ? SPEED_MIN : Math.min(view.speed, SPEED_MAX));

  return (
    <svg
      viewBox="0 0 256 84"
      className={cn('w-full max-w-72', className)}
      role="img"
      aria-label={`Speed ${view.speed ?? 'not set'}. Below ${Math.ceil(view.aeroBlue + 0.5)}: stay; up to ${view.aeroOrange}: 1 space; above: 2 spaces. Brakes stop speeds up to ${Math.floor(brake)}.`}
    >
      <rect
        y="20"
        width="1"
        height="16"
        style={span(LEFT, blue)}
        className={cn('fill-muted', SLIDE)}
      />
      <rect
        y="20"
        width="1"
        height="16"
        style={span(blue, orange)}
        className={cn('fill-pilot-soft', SLIDE)}
      />
      <rect
        y="20"
        width="1"
        height="16"
        style={span(orange, RIGHT)}
        className={cn('fill-copilot-soft', SLIDE)}
      />
      <g className="fill-muted-foreground text-[10px]">
        <text y="32" textAnchor="middle" style={at((LEFT + blue) / 2)} className={SLIDE}>
          0
        </text>
        <text y="32" textAnchor="middle" style={at((blue + orange) / 2)} className={SLIDE}>
          +1
        </text>
        <text
          y="32"
          textAnchor="middle"
          style={at((orange + RIGHT) / 2)}
          className={cn(SLIDE, orange >= RIGHT && 'opacity-0')}
        >
          +2
        </text>
      </g>
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
      <path d="M 0 18 l -6 -12 h 12 z" style={at(blue)} className={cn('fill-pilot', SLIDE)} />
      <path d="M 0 18 l -6 -12 h 12 z" style={at(orange)} className={cn('fill-copilot', SLIDE)} />
      <g style={at(speedX(brake))} className={cn('fill-danger', SLIDE)}>
        <path d="M 0 58 l -6 12 h 12 z" />
        <text x="9" y="80" className="text-[10px]">
          brakes
        </text>
      </g>
      <circle
        cy="28"
        r="7"
        style={at(speedDot)}
        className={cn(
          'fill-foreground stroke-background',
          SLIDE,
          view.speed === null && 'opacity-0',
        )}
        strokeWidth="2"
      >
        {view.speed !== null && <title>{`Speed ${view.speed}`}</title>}
      </circle>
    </svg>
  );
}
