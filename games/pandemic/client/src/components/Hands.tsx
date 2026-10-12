import { cityOf, type Color, type HandCard, type PandemicView } from '@pandemic/rules';
import type { SeatPresence } from '@platform/ui/game';
import { useTranslation } from 'react-i18next';
import { sortHand } from '../lib/cards';
import { cityName, seatName } from '../lib/names';

/** Text on a disease color: dark on yellow, white on the others. */
const TEXT_ON: Record<Color, string> = {
  blue: 'text-white',
  yellow: 'text-yellow-950',
  black: 'text-white',
  red: 'text-white',
};

/**
 * The partners' hands, in the side column: each name, then its cards as badges, a city's on the
 * color of its disease and an event's on gray, with just the name. Hands are open in Pandemic. Your own hand is drawn
 * in the map (`HandCards`).
 */
export function Hands({ view, presence }: { view: PandemicView; presence: SeatPresence | null }) {
  const { t } = useTranslation('pandemic');
  const others = view.seats.filter((seat) => seat !== view.you);
  if (others.length === 0) return null;

  const badge = (card: HandCard, i: number) => {
    const color = card.kind === 'city' ? cityOf(card.city).color : null;
    return (
      <li
        key={i}
        className={`rounded-md border px-2 py-1 ${color ? TEXT_ON[color] : 'bg-gray-200 text-gray-900'}`}
        style={color ? { background: `var(--color-disease-${color})` } : undefined}
      >
        {card.kind === 'city' ? cityName(card.city) : t(`events.${card.event}`)}
      </li>
    );
  };

  return (
    <section aria-label={t('hands.title')} className="flex flex-col gap-2 text-sm">
      {others.map((seat) => {
        const cards = sortHand(view.hands[seat] ?? []);
        return (
          <div key={seat} className="flex flex-col gap-1">
            <p className="font-semibold">{seatName(presence, seat)}</p>
            {cards.length === 0 ? (
              <p className="text-muted-foreground">{t('hands.empty')}</p>
            ) : (
              <ul className="flex flex-wrap gap-1">{cards.map(badge)}</ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
