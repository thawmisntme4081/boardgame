import { lazy, Suspense, useEffect } from 'react';
import { startConnection } from '@/api';
import { Toaster } from '@/components/ui/sonner';
import { Connecting, Lobby, WaitingRoom } from '@/screens/Lobby';
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
  useEffect(startConnection, []);
  return (
    <>
      <Screen />
      <Toaster position="top-center" />
    </>
  );
}
