// The site's pages: file-based routes in `src/routes/`, compiled by the router plugin into
// `routeTree.gen.ts`. The store keeps the live connection and views; the router only decides
// which page shows. The server answers any page path with index.html.
import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { setNavigate } from './api';
import { routeTree } from './routeTree.gen';

/** The site's router; tests pass a memory history to start on any page. */
export function createAppRouter(history?: RouterHistory) {
  const router = createRouter({
    routeTree,
    ...(history && { history }),
    // Unknown paths: the game picker.
    notFoundMode: 'root',
    defaultNotFoundComponent: () => {
      void router.navigate({ to: '/', replace: true });
      return null;
    },
  });
  return router;
}

export const router = createAppRouter();

// The connection code moves the player between pages (joined a room, left it).
setNavigate((path) => void router.navigate({ to: path, replace: true }));

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
