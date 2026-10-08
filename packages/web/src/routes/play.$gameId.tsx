// `/play/:gameId`: a game's lobby.
import { createFileRoute } from '@tanstack/react-router';
import { toOwnRoom } from '../ownRoom';
import { Play } from '../screens/Play';

export const Route = createFileRoute('/play/$gameId')({
  beforeLoad: () => toOwnRoom(),
  component: function PlayPage() {
    return <Play gameId={Route.useParams().gameId} />;
  },
});
