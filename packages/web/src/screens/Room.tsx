// `/r/:code`: a room. Without a seat in it: the join form (an invite link). With one: connecting,
// the waiting room while a seat is empty, then the game's board.
import { Button } from '@platform/ui/components/button';
import { Card, CardContent, CardHeader } from '@platform/ui/components/card';
import type { GameClientModule, SeatPresence } from '@platform/ui/game';
import { Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { leaveGame, shareInvite } from '../api';
import { useGameModule } from '../games';
import { inviteUrl } from '../session';
import { usePlatform } from '../store';
import { CardTop, Connecting, JoinForm, NameField, Shell } from './Shell';
import { useName } from './useName';

const seatsEmpty = (presence: SeatPresence | null) =>
  !presence || Object.entries(presence).some(([seat, info]) => seat !== 'you' && info === null);

/** Waiting for an empty seat to be filled: after creating a room, or after a partner left. */
function WaitingRoom({ module, code }: { module: GameClientModule; code: string }) {
  const { t } = useTranslation();
  const view = usePlatform((s) => s.match?.view);
  const presence = usePlatform((s) => s.presence);
  const { WaitingInfo } = module;
  return (
    <Shell>
      <Card>
        <CardHeader className="flex flex-col gap-2">
          {view !== undefined && <WaitingInfo view={view} presence={presence} />}
          <p className="text-sm text-muted-foreground">{t('lobby.sendCode')}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p
            className="text-center font-mono text-5xl font-bold tracking-[0.3em]"
            aria-label={t('lobby.gameCodeLabel', { spelled: code.split('').join(' ') })}
          >
            {code}
          </p>
          <p className="truncate text-center text-sm text-muted-foreground">{inviteUrl(code)}</p>
          <Button className="h-11" onClick={() => void shareInvite(code)}>
            <Share2 /> {t('lobby.shareInvite')}
          </Button>
          <Button variant="ghost" className="h-11" onClick={() => void leaveGame()}>
            {t('lobby.cancel')}
          </Button>
        </CardContent>
      </Card>
    </Shell>
  );
}

/** The seated player's room, once the game's module has loaded. */
function SeatedRoom({ gameId, code }: { gameId: string; code: string }) {
  const module = useGameModule(gameId);
  const match = usePlatform((s) => s.match);
  const presence = usePlatform((s) => s.presence);
  const connection = usePlatform((s) => s.connection);
  if (!module || !match) return <Connecting />;
  if (seatsEmpty(presence)) return <WaitingRoom module={module} code={code} />;
  const { Board } = module;
  return <Board view={match.view} presence={presence} connection={connection} />;
}

/** An invite link: the room's code, waiting for a name. */
function Invite({ code }: { code: string }) {
  const { t } = useTranslation();
  const { name, setName, fromAccount } = useName();
  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTop title={t('app.title')} description={t('app.tagline')} />
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <NameField name={name} onChange={setName} fromAccount={fromAccount} />
          <JoinForm name={name} initialCode={code} />
        </CardContent>
      </Card>
    </Shell>
  );
}

export function Room({ code }: { code: string }) {
  const session = usePlatform((s) => s.session);
  if (session?.code !== code.toUpperCase()) return <Invite code={code} />;
  return <SeatedRoom gameId={session.game} code={session.code} />;
}
