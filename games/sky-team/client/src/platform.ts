// The platform shell's services (moves, seats, rematch, leave), handed over when the game's
// module loads. The game never talks to the socket itself.
import type { PlatformApi } from '@platform/ui/game';
import type { GameSetup, PlayerMove } from '@sky/rules';

let api: PlatformApi<PlayerMove, GameSetup> | null = null;

export function connectPlatform(platform: PlatformApi<PlayerMove, GameSetup>): void {
  api = platform;
}

export function platform(): PlatformApi<PlayerMove, GameSetup> {
  if (!api) throw new Error('Sky Team used before the platform connected it');
  return api;
}

/** Whether the player is signed in (false before the platform connected, as in unit tests). */
export const signedIn = (): boolean => api?.signedIn() ?? false;
