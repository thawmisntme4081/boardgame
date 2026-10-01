import { useTranslation } from 'react-i18next';
import { useNow } from '@/lib/useNow';
import { useGame } from '@/store';

/**
 * A short breather after each round's last die: "Next turn in 5s", in green. Display only;
 * players still talk strategy and press "Roll dice" as usual. Gone once it reaches 0.
 */
export function NextTurnCountdown() {
  const { t } = useTranslation();
  const nextTurnAt = useGame((s) => s.nextTurnAt);
  const now = useNow();
  if (nextTurnAt === null || now >= nextTurnAt) return null;
  const seconds = Math.ceil((nextTurnAt - now) / 1000);
  return (
    <p
      role="timer"
      aria-label={t('status.nextTurnLabel', { seconds })}
      className="rounded-full bg-light-on px-3 py-1 text-sm font-semibold whitespace-nowrap text-foreground tabular-nums"
    >
      {t('status.nextTurn', { seconds })}
    </p>
  );
}
