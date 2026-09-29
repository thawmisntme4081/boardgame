import { useNow } from '@/lib/useNow';
import { useGame } from '@/store';

/**
 * A short breather after each round's last die: "Next turn in 5s", in green. Display only;
 * players still talk strategy and press "Ready to roll" as usual. Gone once it reaches 0.
 */
export function NextTurnCountdown() {
  const nextTurnAt = useGame((s) => s.nextTurnAt);
  const now = useNow();
  if (nextTurnAt === null || now >= nextTurnAt) return null;
  const seconds = Math.ceil((nextTurnAt - now) / 1000);
  return (
    <p
      role="timer"
      aria-label={`Next turn in ${seconds} seconds`}
      className="rounded-full bg-light-on px-3 py-1 text-sm font-semibold whitespace-nowrap text-foreground tabular-nums"
    >
      Next turn in {seconds}s
    </p>
  );
}
