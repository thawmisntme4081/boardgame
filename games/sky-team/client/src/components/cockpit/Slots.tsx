import type { PlayerView, SlotId } from '@sky/rules';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@platform/ui/utils';
import { Switch } from '../../svgs/Switch';
import { Slot } from '../Slot';

/** Arrow between ordered spaces: right in a row, down in a desktop column (under the slot). */
function OrderArrow({ inColumn }: { inColumn: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-11 items-center text-muted-foreground desktop:h-12',
        inColumn && 'desktop:h-4 desktop:w-12 desktop:justify-center',
      )}
    >
      <ChevronRight className={cn('size-4', inColumn && 'desktop:hidden')} />
      {inColumn && <ChevronDown className="hidden size-4 desktop:block" />}
    </span>
  );
}

/** A row of spaces, each with its toggle switch if the system has them. */
export function Slots({
  ids,
  view,
  switches,
  column,
  ordered,
  className,
}: {
  ids: readonly SlotId[];
  view: PlayerView;
  switches?: readonly boolean[];
  /**
   * Desktop: slots in a column, with each switch on this side of its slot. The column
   * hugs the panel's outer edge: left for `switch-right`, right for `switch-left`.
   */
  column?: 'switch-left' | 'switch-right';
  /** Draw arrows between spaces that must be filled in order. */
  ordered?: boolean;
  className?: string;
}) {
  const { t } = useTranslation('sky-team');
  return (
    <div
      className={cn(
        'flex flex-wrap items-end',
        // Ordered spaces sit tight around their arrows (brakes, flaps).
        ordered ? 'gap-0' : 'gap-2',
        column && 'desktop:flex-col',
        column === 'switch-right' && 'desktop:items-start',
        column === 'switch-left' && 'desktop:items-end',
        column && (ordered ? 'desktop:gap-0' : 'desktop:gap-5'),
        className,
      )}
    >
      {ids.map((id, i) => (
        <Fragment key={id}>
          {ordered && i > 0 && <OrderArrow inColumn={column !== undefined} />}
          <div
            className={cn(
              'flex flex-col items-center gap-1',
              column === 'switch-left' && 'desktop:flex-row desktop:gap-2',
              column === 'switch-right' && 'desktop:flex-row-reverse desktop:gap-2',
            )}
          >
            {switches && <Switch on={switches[i]!} label={t('cockpit.switch', { n: i + 1 })} />}
            <Slot slot={id} view={view} />
          </div>
        </Fragment>
      ))}
    </div>
  );
}
