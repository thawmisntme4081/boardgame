import { CITIES, COLORS, type PandemicView } from '@pandemic/rules';
import type { SeatPresence } from '@platform/ui/game';
import { useTranslation } from 'react-i18next';
import { cityName, seatName } from '../lib/names';

/** The cities that have cubes, a research station or a pawn, as a list. */
export function Cities({ view, presence }: { view: PandemicView; presence: SeatPresence | null }) {
  const { t } = useTranslation('pandemic');
  const rows = CITIES.flatMap(({ id }) => {
    const parts: string[] = [];
    for (const color of COLORS) {
      const count = view.cubes[id][color];
      if (count > 0) parts.push(t('map.cubes', { count, color: t(`color.${color}`) }));
    }
    if (view.stations.includes(id)) parts.push(t('map.station'));
    for (const seat of view.seats) {
      if (view.pawns[seat] === id) parts.push(seatName(presence, seat));
    }
    return parts.length > 0 ? [{ id, parts }] : [];
  });
  return (
    <section aria-labelledby="cities-title" className="flex flex-col gap-1 text-sm">
      <h2 id="cities-title" className="font-semibold">
        {t('map.title')}
      </h2>
      {rows.length === 0 && <p className="text-muted-foreground">{t('map.empty')}</p>}
      <ul>
        {rows.map(({ id, parts }) => (
          <li key={id}>
            <span className="font-medium">{cityName(id)}</span>: {parts.join(', ')}
          </li>
        ))}
      </ul>
    </section>
  );
}
