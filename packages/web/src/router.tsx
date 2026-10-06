// The site's pages. The store keeps the live connection and views; the router only decides
// which page shows. The server answers any page path with index.html.
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router';
import { setNavigate } from './api';
import { Picker } from './screens/Picker';
import { Play } from './screens/Play';
import { Room } from './screens/Room';
import { usePlatform } from './store';

/** A player with a seat always lands in their room (a reload, an old link, the back button). */
function toOwnRoom(code?: string) {
  const session = usePlatform.getState().session;
  if (session && session.code !== code?.toUpperCase()) {
    throw redirect({ to: '/r/$code', params: { code: session.code }, replace: true });
  }
}

const root = createRootRoute({ component: Outlet });

const picker = createRoute({
  getParentRoute: () => root,
  path: '/',
  beforeLoad: () => toOwnRoom(),
  component: Picker,
});

const play = createRoute({
  getParentRoute: () => root,
  path: '/play/$gameId',
  beforeLoad: () => toOwnRoom(),
  component: function PlayPage() {
    return <Play gameId={play.useParams().gameId} />;
  },
});

const room = createRoute({
  getParentRoute: () => root,
  path: '/r/$code',
  beforeLoad: ({ params }) => toOwnRoom(params.code),
  component: function RoomPage() {
    return <Room code={room.useParams().code} />;
  },
});

const routeTree = root.addChildren([picker, play, room]);

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
