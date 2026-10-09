import { cityOf, type HandCard } from '@pandemic/rules';
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
