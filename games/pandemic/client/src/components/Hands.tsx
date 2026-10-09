import type { PandemicView } from '@pandemic/rules';
import type { SeatPresence } from '@platform/ui/game';
import { useTranslation } from 'react-i18next';
import { useCardText, sortHand } from '../lib/cards';
import { playerCardUrl } from '../lib/cardImages';
import { seatName } from '../lib/names';

const CARD_HEIGHT = 96;

/**
 * The hands, in the side column: your own hand as card pictures, sorted by color; the others'
 * hands collapsed to their count, each opening to its cards. Cards wrap onto more rows. Hands are open in Pandemic, so all are shown.
 */
export function Hands({ view, presence }: { view: PandemicView; presence: SeatPresence | null }) {
  const { t } = useTranslation('pandemic');
  const cardText = useCardText();
  const hand = (seat: string) => sortHand(view.hands[seat as keyof typeof view.hands] ?? []);
  const others = view.seats.filter((seat) => seat !== view.you);

  const cards = (cardsOf: ReturnType<typeof sortHand>) =>
    cardsOf.map((card, i) => (
      <img
        key={i}
        src={playerCardUrl(card)}
        alt={cardText(card)}
        title={cardText(card)}
        height={CARD_HEIGHT}
        className="w-auto shrink-0 rounded-lg shadow"
        style={{ height: CARD_HEIGHT }}
      />
    ));

  return (
    <section aria-labelledby="hands-title" className="flex flex-col gap-2 text-sm">
      <h2 id="hands-title" className="font-semibold">
        {t('hands.title')}
      </h2>
      <div className="flex flex-col gap-3">
        {view.you && (
          <div className="flex flex-col gap-1">
            <p className="font-medium">
              {seatName(presence, view.you)} ({t('board.you')})
            </p>
            <div className="flex flex-wrap gap-1">
              {hand(view.you).length === 0 ? (
                <p className="text-muted-foreground">{t('hands.empty')}</p>
              ) : (
                cards(hand(view.you))
              )}
            </div>
          </div>
        )}
        {others.map((seat) => {
          const cardsOf = hand(seat);
          return (
            <details key={seat} className="group flex flex-col gap-1">
              <summary className="cursor-pointer font-medium">
                {seatName(presence, seat)}
                <span className="ml-1 font-normal text-muted-foreground">
                  {t('hands.count', { count: cardsOf.length })}
                </span>
              </summary>
              <div className="flex flex-wrap gap-1 pt-1">
                {cardsOf.length === 0 ? (
                  <p className="text-muted-foreground">{t('hands.empty')}</p>
                ) : (
                  cards(cardsOf)
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
