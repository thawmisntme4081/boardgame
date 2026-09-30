import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export const PANEL = 'flex h-full flex-col gap-2 rounded-2xl border bg-card p-3';
/** The same panel look, applied only on desktop (the two radio halves). */
export const DESKTOP_PANEL =
  'desktop:flex desktop:h-full desktop:flex-col desktop:gap-2 desktop:rounded-2xl desktop:border desktop:bg-card desktop:p-3';

/**
 * Marks a panel whose two dice must both be placed every round (axis, engines). Tap for
 * the reason (no hover-only info); the small icon gets a 44px touch area from `after:`.
 */
function MandatoryMark({ title }: { title: string }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`${title} is mandatory`}
        className="relative inline-grid place-items-center rounded-full text-danger outline-none after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <CircleAlert aria-hidden="true" className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-64">
        <PopoverHeader>
          <PopoverTitle>Mandatory</PopoverTitle>
          <PopoverDescription>
            Place both dice here every round. If a round ends without both axis and both engine
            dice, the plane goes down.
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}

export function PanelHeader({
  title,
  hint,
  side,
  mandatory,
  className,
}: {
  title: string;
  hint?: ReactNode;
  side?: boolean;
  mandatory?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex items-baseline justify-between gap-2',
        side && 'desktop:flex-col desktop:items-start desktop:gap-0',
        className,
      )}
    >
      <h2 className="flex items-center gap-1 text-sm font-semibold">
        {title}
        {mandatory && <MandatoryMark title={title} />}
      </h2>
      {hint && (
        <p className={cn('text-right text-xs text-muted-foreground', side && 'desktop:text-left')}>
          {hint}
        </p>
      )}
    </header>
  );
}

export function Panel({
  title,
  hint,
  side,
  mandatory,
  className,
  children,
}: {
  title: string;
  hint?: ReactNode;
  side?: boolean;
  mandatory?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(PANEL, className)} aria-label={title}>
      <PanelHeader title={title} hint={hint} side={side} mandatory={mandatory} />
      {children}
    </section>
  );
}
