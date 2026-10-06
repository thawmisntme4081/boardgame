import { cn } from '@platform/ui/utils';

/**
 * An Intern token as an ID badge on a green lanyard (the Intern panel's token row). The
 * card is 3:4 (60 × 80) under the lanyard, so size it by height (`h-*`, width follows).
 */
export function InternBadge({ value, className }: { value: number; className?: string }) {
  return (
    <svg viewBox="0 0 66 110" className={cn('block w-auto', className)} aria-hidden="true">
      <path
        d="M17 0 H27 L33 11 L39 0 H49 L39 24 H27 Z"
        strokeWidth="2"
        strokeLinejoin="round"
        className="fill-green-500 stroke-green-700"
      />
      <rect x="24" y="20" width="18" height="9" rx="2" className="fill-zinc-600" />
      <rect
        x="3"
        y="27"
        width="60"
        height="80"
        rx="10"
        strokeWidth="3"
        className="fill-zinc-300 stroke-green-500 dark:fill-zinc-700"
      />
      <rect
        x="11"
        y="42"
        width="44"
        height="56"
        rx="7"
        strokeWidth="2"
        className="fill-white stroke-zinc-400 dark:fill-zinc-800 dark:stroke-zinc-500"
      />
      <text
        x="33"
        y="83"
        textAnchor="middle"
        className="fill-zinc-800 text-[38px] font-extrabold dark:fill-zinc-50"
      >
        {value}
      </text>
    </svg>
  );
}
