import { lazy, Suspense, useEffect } from 'react';
import { checkSiteAccess, startConnection } from '@/api';
import { Toaster } from '@/components/ui/sonner';
import { Connecting, Lobby, WaitingRoom } from '@/screens/Lobby';
import { SitePassword } from '@/screens/SitePassword';
import { useGame } from '@/store';

// The board is the heavy part; the lobby loads without it.
const Game = lazy(() => import('@/screens/Game'));

function Screen() {
  const session = useGame((s) => s.session);
  const view = useGame((s) => s.view);
  const presence = useGame((s) => s.presence);

  if (!session) return <Lobby />;
  if (!view) return <Connecting />;
  if (!presence?.pilot || !presence.copilot) {
    return (
      <WaitingRoom
        code={session.code}
        missing={presence?.pilot ? 'copilot' : 'pilot'}
        timerMs={view.timerMs}
        scenario={view.scenario}
      />
    );
  }
  return (
    <Suspense fallback={<Connecting />}>
      <Game view={view} presence={presence} />
    </Suspense>
  );
}

export function App() {
  const siteAccess = useGame((s) => s.siteAccess);
  // A private site asks for its password before anything else; the game connects after.
  useEffect(() => {
    void checkSiteAccess().then((ok) => useGame.getState().setSiteAccess(ok ? 'open' : 'locked'));
  }, []);
  useEffect(() => {
    if (siteAccess === 'open') startConnection();
  }, [siteAccess]);
  return (
    <>
      {siteAccess === 'checking' ? (
        <Connecting />
      ) : siteAccess === 'locked' ? (
        <SitePassword />
      ) : (
        <Screen />
      )}
      <Toaster position="top-center" />
    </>
  );
}
