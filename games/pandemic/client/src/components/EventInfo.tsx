import type { EventId } from '@pandemic/rules';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@platform/ui/components/hover-card';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** What an event card says: its name and text, in a card that opens when the pointer rests on it. */
export function EventInfo({ event, children }: { event: EventId; children: ReactNode }) {
  const { t } = useTranslation('pandemic');
  return (
    <HoverCard openDelay={150} closeDelay={50}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="top" className="flex flex-col gap-1">
        <p className="font-semibold">{t(`events.${event}`)}</p>
        <p>{t(`eventInfo.${event}`)}</p>
      </HoverCardContent>
    </HoverCard>
  );
}
