import type { TableView } from '@pandemic/rules';
import type { SeatPresence } from '@platform/ui/game';
import { useTranslation } from 'react-i18next';

/** The waiting room's heading: how many players are still missing, and the table's size. */
export function WaitingInfo({ view }: { view: TableView; presence?: SeatPresence | null }) {
  const { t } = useTranslation('pandemic');
  if (view.status !== 'waiting') return null;
  const missing = Math.max(view.players - view.seated.length, 0);
  return (
    <>
      <h2 className="text-xl font-semibold">{t('lobby.waitingForPlayers', { count: missing })}</h2>
      <p className="text-sm text-muted-foreground">
        {t('lobby.playerCount', { count: view.players })} ·{' '}
        {t('lobby.epidemics', { count: view.epidemics })}
      </p>
    </>
  );
}
