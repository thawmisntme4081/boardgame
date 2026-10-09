import type { PandemicView } from '@pandemic/rules';
import type { SeatPresence } from '@platform/ui/game';
import { useTranslation } from 'react-i18next';
import { useCardText } from '../lib/cards';
import { seatName } from '../lib/names';

/** Every player's hand: hands are open in Pandemic. */
export function Hands({ view, presence }: { view: PandemicView; presence: SeatPresence | null }) {
  const { t } = useTranslation('pandemic');
  const cardText = useCardText();
  return (
    <section aria-labelledby="hands-title" className="flex flex-col gap-1 text-sm">
      <h2 id="hands-title" className="font-semibold">
        {t('hands.title')}
      </h2>
      <div className="flex gap-8">
        {view.seats.map((seat) => {
          const hand = view.hands[seat] ?? [];
          return (
            <div key={seat}>
              <p className="font-medium">
                {seatName(presence, seat)}
                {seat === view.you ? ` (${t('board.you')})` : ''}
              </p>
              {hand.length === 0 ? (
                <p className="text-muted-foreground">{t('hands.empty')}</p>
              ) : (
                <ul>
                  {hand.map((card, i) => (
                    <li key={i}>{cardText(card)}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
