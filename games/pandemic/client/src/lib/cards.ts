import { cityOf, type Color, type HandCard } from '@pandemic/rules';
import { useTranslation } from 'react-i18next';
import { cityName } from './names';

/** Text for one card in a hand. */
export function useCardText() {
  const { t } = useTranslation('pandemic');
  return (card: HandCard): string =>
    card.kind === 'city'
      ? t('hands.city', {
          name: cityName(card.city),
          color: t(`color.${cityOf(card.city).color}`),
        })
      : t('hands.event', { name: t(`events.${card.event}`) });
}

const COLOR_ORDER: readonly Color[] = ['blue', 'yellow', 'black', 'red'];

/** A hand sorted by color (blue, yellow, black, red), the event cards last. Keeps each card's name order. */
export function sortHand(hand: readonly HandCard[]): HandCard[] {
  const rank = (card: HandCard) =>
    card.kind === 'city' ? COLOR_ORDER.indexOf(cityOf(card.city).color) : COLOR_ORDER.length;
  return [...hand].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.kind === 'city' && b.kind === 'city'
        ? cityName(a.city).localeCompare(cityName(b.city))
        : 0),
  );
}
