import { useNow } from '@/lib/useNow';
import { useGame } from '@/store';

/** Time left in the green "Next turn in 5s" pause after a round's last die, or `null` outside it. */
export function useNextTurnLeft(): number | null {
  const nextTurnAt = useGame((s) => s.nextTurnAt);
  const now = useNow();
  return nextTurnAt !== null && now < nextTurnAt ? nextTurnAt - now : null;
}
