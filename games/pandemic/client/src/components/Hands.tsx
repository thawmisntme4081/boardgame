import { cityOf, type HandCard, type PandemicView } from '@pandemic/rules';
import { platform } from '../platform';
import type { SeatPresence } from '@platform/ui/game';
import { useTranslation } from 'react-i18next';
import { sortHand } from '../lib/cards';
import { DISEASE_PALE_TEXT, diseasePale } from '../lib/colors';
import { cityName, seatName } from '../lib/names';
import { usePandemic } from '../store';
import { EventInfo } from './EventInfo';

export function Hands({ view, presence }: { view: PandemicView; presence: SeatPresence | null }) {
  const { t } = useTranslation('pandemic');
  const setHoverCity = usePandemic((s) => s.setHoverCity);
  const seats = [...view.seats].sort((a, b) => Number(b === view.you) - Number(a === view.you));
  if (seats.length === 0) return null;

  // Over the hand limit: pressing one of your own cards discards it.
  const discarding = view.pending?.kind === 'discard' && view.pending.seat === view.you;
  const badge = (card: HandCard, i: number, mine: boolean) => {
    const color = card.kind === 'city' ? cityOf(card.city).color : null;
    const item = (
      <li
        key={i}
        className={`rounded-md border px-2 py-1 ${color ? DISEASE_PALE_TEXT : 'bg-gray-100 text-gray-900'} ${
          mine && discarding ? 'cursor-pointer ring-2 ring-red-500 hover:brightness-95' : ''
        }`}
        style={color ? diseasePale(color) : undefined}
        // Over the hand limit, your own cards are buttons: pressing one discards it.
        {...(mine && discarding
          ? {
              role: 'button',
              tabIndex: 0,
              onClick: () => void platform().send({ type: 'discard', card }),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void platform().send({ type: 'discard', card });
                }
              },
            }
          : {})}
        onPointerEnter={() => card.kind === 'city' && setHoverCity(card.city)}
        onPointerLeave={() => setHoverCity(null)}
      >
        {card.kind === 'city' ? cityName(card.city) : t(`events.${card.event}`)}
      </li>
    );
    return card.kind === 'event' ? (
      <EventInfo key={i} event={card.event}>
        {item}
      </EventInfo>
    ) : (
      item
    );
  };

  return (
    <section aria-label={t('hands.title')} className="flex flex-col gap-2 text-sm">
      {seats.map((seat) => {
        const cards = sortHand(view.hands[seat] ?? []);
        return (
          <div key={seat} className="flex flex-col gap-1">
            <p className="font-semibold">
              {seatName(presence, seat)}
              {seat === view.you && (
                <span className="ml-1 font-normal text-muted-foreground">({t('common.you')})</span>
              )}
            </p>
            {cards.length === 0 ? (
              <p className="text-muted-foreground">{t('hands.empty')}</p>
            ) : (
              <ul className="flex flex-wrap gap-1">
                {cards.map((card, i) => badge(card, i, seat === view.you))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
