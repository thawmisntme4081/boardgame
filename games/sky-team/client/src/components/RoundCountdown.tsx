import { Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatClock } from '../lib/clock';
import { useNow } from '../lib/useNow';
import { cn } from '@platform/ui/utils';
import { useSkyTeam } from '../store';

/** The last stretch of a round is shown in red. */
const WARN_MS = 30_000;

/**
 * Timed games: the time left to place this round's dice. Only a display: the server
 * decides when time is up. Renders nothing when no countdown is running.
 */
export function RoundCountdown() {
  const { t } = useTranslation('sky-team');
  const deadline = useSkyTeam((s) => s.roundDeadline);
  const now = useNow();

  if (deadline === null) return null;
  const left = Math.max(0, deadline - now);
  return (
    <p
      role="timer"
      aria-label={t('status.timeLeft', { time: formatClock(left) })}
      className={cn(
        'flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap tabular-nums',
        left <= WARN_MS ? 'bg-danger text-white' : 'bg-muted',
      )}
    >
      <Timer className="size-4" aria-hidden="true" />
      {formatClock(left)}
    </p>
  );
}
