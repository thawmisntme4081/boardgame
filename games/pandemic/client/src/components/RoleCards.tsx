import { MAX_STUDENTS, pawnsOf, type PandemicView, type RoleId } from '@pandemic/rules';
import { Popover, PopoverContent, PopoverTrigger } from '@platform/ui/components/popover';
import type { SeatPresence } from '@platform/ui/game';
import { useTranslation } from 'react-i18next';
import { seatName } from '../lib/names';

/** Text on a role's color: dark on the light ones. */
const TEXT_ON: Record<RoleId, string> = {
  'contingency-planner': 'text-black',
  dispatcher: 'text-white',
  medic: 'text-black',
  'operations-expert': 'text-black',
  'quarantine-specialist': 'text-white',
  researcher: 'text-white',
  scientist: 'text-black',
  teacher: 'text-white',
};

/**
 * One role card per player, in the color of their pawn: the role's name under the player's, and
 * its power in a popover.
 */
export function RoleCards({
  view,
  presence,
}: {
  view: PandemicView;
  presence: SeatPresence | null;
}) {
  const { t } = useTranslation('pandemic');
  return (
    <section aria-label={t('roles.title')} className="flex flex-wrap gap-2 p-1.5 text-sm">
      {view.seats.map((seat) => {
        const role = view.roles[seat];
        if (!role) return null;
        const name = t(`roles.${role}.name`);
        // The player whose turn it is stands out: a yellow border that pulses (`.turn-ring`).
        const active = view.status === 'playing' && view.turn.seat === seat;
        return (
          <Popover key={seat}>
            <PopoverTrigger
              aria-label={t('roles.info', { role: name })}
              data-role={role}
              aria-current={active ? 'true' : undefined}
              className={`flex min-w-0 flex-1 flex-col rounded-md border px-3 py-1.5 text-left shadow-sm ${TEXT_ON[role]} ${active ? 'turn-ring' : ''}`}
              style={{ background: `var(--color-role-${role})` }}
            >
              <span className="truncate text-xs opacity-80">{seatName(presence, seat)}</span>
              <span className="font-semibold">{name}</span>
              {role === 'teacher' && (
                <span className="text-xs">
                  {t('roles.students', {
                    count: pawnsOf(view, seat).length - 1,
                    max: MAX_STUDENTS,
                  })}
                </span>
              )}
              {role === 'contingency-planner' && view.contingency && (
                <span className="text-xs">
                  {t('roles.stored', { event: t(`events.${view.contingency}`) })}
                </span>
              )}
            </PopoverTrigger>
            <PopoverContent>
              <p className="font-semibold">{name}</p>
              <p>{t(`roles.${role}.power`)}</p>
            </PopoverContent>
          </Popover>
        );
      })}
    </section>
  );
}
