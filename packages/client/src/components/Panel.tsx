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

const PANEL = 'flex h-full flex-col gap-2 rounded-2xl border bg-card p-3';
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

interface PanelProps {
  title: string;
  /** Opens from the info icon next to the title. */
  hint?: ReactNode;
  /** Desktop: the badge goes under the title (narrow side panels: Landing gear, Flaps). */
  stackHeaderOnDesktop?: boolean;
  /** A red info icon: both dice must go here every round (Axis, Engines). */
  mandatory?: boolean;
  /** Shown right after the title, e.g. the marker a system moves. */
  badge?: ReactNode;
}

function PanelHeader({ title, hint, stackHeaderOnDesktop, mandatory, badge }: PanelProps) {
  return (
    <header
      className={cn(
        'flex items-baseline justify-between gap-2',
        stackHeaderOnDesktop && 'desktop:flex-col desktop:items-start desktop:gap-0',
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

/** A cockpit panel: a card with its title (and info icon, badge) above the content. */
export function Panel({
  className,
  children,
  ...header
}: PanelProps & { className?: string; children: ReactNode }) {
  return (
    <section className={cn(PANEL, className)} aria-label={header.title}>
      <PanelHeader {...header} />
      {children}
    </section>
  );
}
