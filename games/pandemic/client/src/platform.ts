// The platform shell's services (moves, seats, rematch, leave), handed over when the game's
// module loads. The game never talks to the socket itself.
import type { PandemicLobby, PandemicMove } from '@pandemic/rules/definition';
import type { PlatformApi } from '@platform/ui/game';

let api: PlatformApi<PandemicMove, PandemicLobby> | null = null;

export function connectPlatform(platform: PlatformApi<PandemicMove, PandemicLobby>): void {
  api = platform;
}

export function platform(): PlatformApi<PandemicMove, PandemicLobby> {
  if (!api) throw new Error('Pandemic used before the platform connected it');
  return api;
}
