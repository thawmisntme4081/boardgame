import { useEffect } from 'react';

/**
 * Marks the page with the game room it is showing (`<html data-game="sky-team">`; not the lobby, which keeps the platform theme), so a game's own
 * stylesheet can give its pages their colors (e.g. `html[data-game='sky-team'] { --primary: … }`),
 * dialogs and toasts included, since they inherit from the page. The shell knows no game's colors.
 */
export function useGameTheme(gameId: string): void {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.game = gameId;
    return () => {
      if (root.dataset.game === gameId) delete root.dataset.game;
    };
  }, [gameId]);
}
