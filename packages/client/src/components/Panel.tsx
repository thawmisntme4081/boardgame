import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
 * The panel's info icon: tap for its hint (no hover-only info). Red on a panel whose two
 * dice must both be placed every round (axis, engines), whose popover also says why; gray
 * elsewhere. The small icon gets a 44px touch area from `after:`.
 */
function PanelInfo({
  title,
  hint,
  mandatory,
}: {
  title: string;
  hint?: ReactNode;
  mandatory?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger
        aria-label={mandatory ? t('cockpit.isMandatory', { title }) : t('cockpit.about', { title })}
        className={cn(
          'relative inline-grid place-items-center rounded-full outline-none after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 focus-visible:ring-3 focus-visible:ring-ring/50',
          mandatory ? 'text-danger' : 'text-muted-foreground',
        )}
      >
        <CircleAlert aria-hidden="true" className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-64">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          {hint && <PopoverDescription>{hint}</PopoverDescription>}
        </PopoverHeader>
        {mandatory && (
          <PopoverHeader>
            <PopoverTitle className="text-danger">{t('cockpit.mandatory')}</PopoverTitle>
            <PopoverDescription>{t('cockpit.mandatoryBody')}</PopoverDescription>
          </PopoverHeader>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function PanelHeader({
  title,
  hint,
  side,
  mandatory,
  badge,
  className,
}: {
  title: string;
  hint?: ReactNode;
  side?: boolean;
  mandatory?: boolean;
  /** Shown right after the title, e.g. the marker a system moves. */
  badge?: ReactNode;
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
        {(hint || mandatory) && <PanelInfo title={title} hint={hint} mandatory={mandatory} />}
        {badge && <span className="text-xs font-normal text-muted-foreground">{badge}</span>}
      </h2>
    </header>
  );
}

export function Panel({
  title,
  hint,
  side,
  mandatory,
  badge,
  className,
  children,
}: {
  title: string;
  hint?: ReactNode;
  side?: boolean;
  mandatory?: boolean;
  badge?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(PANEL, className)} aria-label={title}>
      <PanelHeader title={title} hint={hint} side={side} mandatory={mandatory} badge={badge} />
      {children}
    </section>
  );
}
