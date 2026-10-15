import type { SeatPresence } from '@platform/ui/game';
import { useRouterState } from '@tanstack/react-router';
import { usePlatform } from './store';

/** A seat is still empty (or the table is not known yet): the room waits for players. */
export const seatsEmpty = (presence: SeatPresence | null) =>
  !presence || Object.entries(presence).some(([seat, info]) => seat !== 'you' && info === null);

/**
 * The game whose board is on screen (the player's room, every seat taken), or `null`. The board
 * fills the window, so the site layout leaves its header out unless the game asks for it.
 */
export function useBoardGame(): string | null {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const session = usePlatform((s) => s.session);
  const match = usePlatform((s) => s.match);
  const presence = usePlatform((s) => s.presence);
  const code = /^\/r\/([^/]+)/.exec(path)?.[1]?.toUpperCase();
  return code && session?.code === code && match && !seatsEmpty(presence) ? session.game : null;
}
