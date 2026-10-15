// The layout of the site's pages (the picker, a game's lobby, History, a room before its board):
// the header, then the page. A seated player's board fills the window, so it has no header,
// unless the game gives the header a part of its own (`HeaderExtra`): then the header stays and
// the board fills the window below it. The page stays in the same place in every case, so
// moving between them never starts it over.
import { Outlet } from '@tanstack/react-router';
import { useBoardGame } from '../boardShown';
import { useGameModuleOf } from '../games';
import { usePlatform } from '../store';
import { SiteHeader } from './Shell';

export function SiteLayout() {
  const game = useBoardGame();
  const Extra = useGameModuleOf(game)?.HeaderExtra;
  const match = usePlatform((s) => s.match);
  const presence = usePlatform((s) => s.presence);
  const onSitePage = game === null;
  const withHeader = onSitePage || (Extra !== undefined && match !== null);
  return (
    <div
      className={
        onSitePage
          ? 'flex min-h-dvh flex-col bg-muted/40'
          : withHeader
            ? 'flex h-dvh flex-col'
            : 'contents'
      }
    >
      {withHeader && (
        <SiteHeader
          account
          extra={Extra && match ? <Extra view={match.view} presence={presence} /> : undefined}
        />
      )}
      <div className={!onSitePage && withHeader ? 'flex min-h-0 flex-1 flex-col' : 'contents'}>
        <Outlet />
      </div>
    </div>
  );
}
