/**
 * A cockpit switch (landing gear, flaps, brakes). Like the board's slide switches: off
 * covers the light, on slides aside to show green.
 */
export function Switch({ on, label }: { on: boolean; label: string }) {
  return (
    <svg
      viewBox="0 0 36 20"
      className="h-5 w-9 shrink-0"
      role="img"
      aria-label={`${label}: ${on ? 'deployed' : 'not deployed'}`}
    >
      <rect
        x="1"
        y="1"
        width="34"
        height="18"
        rx="9"
        className={on ? 'fill-light-on' : 'fill-light-off'}
      />
      <circle
        cx={on ? 26 : 10}
        cy="10"
        r="7"
        className="fill-white stroke-foreground/15 transition-all"
        strokeWidth="1"
      />
    </svg>
  );
}
