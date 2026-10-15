import { cityOf, type HandCard, type PandemicView } from '@pandemic/rules';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@platform/ui/components/dialog';
import { useTranslation } from 'react-i18next';
import { DISEASE_PALE_TEXT, diseasePale } from '../lib/colors';
import { cityName } from '../lib/names';
import { usePandemic } from '../store';

/** A city's card, as a badge in its disease's color. */
function CityBadge({ city }: { city: Parameters<typeof cityOf>[0] }) {
  return (
    <li
      className={`rounded-md border px-2 py-1 text-sm ${DISEASE_PALE_TEXT}`}
      style={diseasePale(cityOf(city).color)}
    >
      {cityName(city)}
    </li>
  );
}

/**
 * The cards of a discard pile, newest first: opens when a discard pile on the map is pressed
 * (`pile` in the store). Both piles are open to everyone, as in the box.
 */
export function PilesDialog({ view }: { view: PandemicView }) {
  const { t } = useTranslation('pandemic');
  const pile = usePandemic((s) => s.pile);
  const openPile = usePandemic((s) => s.openPile);
  const cards: readonly HandCard[] | readonly string[] =
    pile === 'player' ? view.playerDiscard : view.infectionDiscard;
  const newestFirst = [...cards].reverse();
  return (
    <Dialog open={pile !== null} onOpenChange={(open) => !open && openPile(null)}>
      <DialogContent className="max-h-[80dvh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pile === 'player' ? t('piles.player') : t('piles.infection')}</DialogTitle>
          <DialogDescription>{t('piles.count', { count: cards.length })}</DialogDescription>
        </DialogHeader>
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('piles.empty')}</p>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {newestFirst.map((card, i) =>
              typeof card === 'string' ? (
                <CityBadge key={`${card}-${i}`} city={card as never} />
              ) : card.kind === 'city' ? (
                <CityBadge key={`${card.city}-${i}`} city={card.city} />
              ) : (
                <li
                  key={`${card.event}-${i}`}
                  className="rounded-md border bg-gray-100 px-2 py-1 text-sm text-gray-900"
                >
                  {t(`events.${card.event}`)}
                </li>
              ),
            )}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
