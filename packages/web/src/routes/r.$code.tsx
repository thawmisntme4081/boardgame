// `/r/:code`: a room (an invite link, or the player's own seat).
import { createFileRoute } from '@tanstack/react-router';
import { toOwnRoom } from '../ownRoom';
import { Room } from '../screens/Room';

export const Route = createFileRoute('/r/$code')({
  beforeLoad: ({ params }) => toOwnRoom(params.code),
  component: function RoomPage() {
    return <Room code={Route.useParams().code} />;
  },
});
