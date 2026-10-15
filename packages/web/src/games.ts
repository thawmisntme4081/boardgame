// The games this site hosts, for the game picker and the rooms. A game's client module (its
// board, lobby options and texts) is a separate chunk, loaded the first time it is needed.
import type { GameClientModule, PlatformApi } from '@platform/ui/game';
import { addLocales } from '@platform/ui/i18n';
import { useEffect, useState } from 'react';
import pandemicImage from './assets/thumbnails/pandemic.webp';
import skyTeamImage from './assets/thumbnails/sky-team.webp';

export interface GameInfo {
  id: string;
  load: () => Promise<{ default: GameClientModule }>;
  image: string;
}

export const GAMES: readonly GameInfo[] = [
  {
    id: 'sky-team',
    load: () => import('@sky/client') as Promise<{ default: GameClientModule }>,
    image: skyTeamImage,
  },
  {
    id: 'pandemic',
    load: () => import('@pandemic/client') as Promise<{ default: GameClientModule }>,
    image: pandemicImage,
  },
];

export const gameInfo = (id: string): GameInfo | undefined => GAMES.find((g) => g.id === id);

/**
 * Starts downloading a game's chunk before a page needs it (hovering its card, opening its page
 * directly); `loadGame` then finds it ready. Unknown ids are ignored.
 */
export function preloadGame(id: string): void {
  void gameInfo(id)
    ?.load()
    .catch(() => undefined);
}

let services: PlatformApi<unknown, unknown> | null = null;
const loading = new Map<string, Promise<GameClientModule>>();
const loaded = new Map<string, GameClientModule>();

/** The shell's services, handed to every game module when it loads. */
export function provideServices(platform: PlatformApi<unknown, unknown>): void {
  services = platform;
}

/** Loads a game's module once: its texts are registered and the shell's services connected. */
export function loadGame(id: string): Promise<GameClientModule> {
  let promise = loading.get(id);
  if (!promise) {
    const info = gameInfo(id);
    promise = info
      ? info.load().then(({ default: module }) => {
          addLocales(module.id, module.locales);
          if (services) module.connect(services);
          loaded.set(id, module);
          return module;
        })
      : Promise.reject(new Error(`unknown game ${id}`));
    loading.set(id, promise);
  }
  return promise;
}

/** A game's module if it has loaded already (for code outside React: views, errors). */
export const loadedGame = (id: string): GameClientModule | undefined => loaded.get(id);

/** Like `useGameModule`, for a page that may not be in a game (`null`: no module, nothing loads). */
export function useGameModuleOf(id: string | null): GameClientModule | null {
  const [module, setModule] = useState(() => (id ? (loadedGame(id) ?? null) : null));
  useEffect(() => {
    if (!id) return;
    let live = true;
    void loadGame(id).then((m) => live && setModule(m));
    return () => {
      live = false;
    };
  }, [id]);
  return id && module?.id === id ? module : null;
}

/** A game's module for a page: `null` while it loads (at once if it has loaded already). */
export function useGameModule(id: string): GameClientModule | null {
  const [module, setModule] = useState(() => loadedGame(id) ?? null);
  useEffect(() => {
    let live = true;
    void loadGame(id).then((m) => live && setModule(m));
    return () => {
      live = false;
    };
  }, [id]);
  return module?.id === id ? module : null;
}
