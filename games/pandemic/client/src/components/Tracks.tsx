import { COLORS, INFECTION_RATES, MAX_OUTBREAKS, type PandemicView } from '@pandemic/rules';
import { useTranslation } from 'react-i18next';

/** Outbreaks, infection rate, decks, cubes left and cures, as plain text. */
export function Tracks({ view }: { view: PandemicView }) {
  const { t } = useTranslation('pandemic');
  return (
    <section aria-labelledby="tracks-title" className="flex flex-col gap-1 text-sm">
      <h2 id="tracks-title" className="font-semibold">
        {t('tracks.title')}
      </h2>
      <p>{t('tracks.outbreaks', { count: view.outbreaks, max: MAX_OUTBREAKS })}</p>
      <p>{t('tracks.infectionRate', { count: INFECTION_RATES[view.infectionRate] ?? 0 })}</p>
      <p>{t('tracks.playerDeck', { count: view.playerDeckSize })}</p>
      <p>{t('tracks.infectionDeck', { count: view.infectionDeckSize })}</p>
      <p className="font-medium">{t('tracks.cures')}</p>
      <ul>
        {COLORS.map((color) => (
          <li key={color}>
            {t(`color.${color}`)}: {t(`tracks.cureState.${view.cures[color]}`)} ·{' '}
            {t('tracks.supply')} {view.supply[color]}
          </li>
        ))}
      </ul>
    </section>
  );
}
