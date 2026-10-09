// `/r/:code`: a room. Without a seat in it: the join form (an invite link). With one: connecting,
// the waiting room while a seat is empty, then the game's board.
import { Button } from '@platform/ui/components/button';
import { Card, CardContent, CardHeader } from '@platform/ui/components/card';
import { seatInfo, type GameClientModule, type SeatPresence } from '@platform/ui/game';
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

const seatsOf = (presence: SeatPresence | null) =>
  Object.keys(presence ?? {}).filter((seat) => seat !== 'you');

/** Who is seated and how many seats are still open: shown when a table has more than two. */
function SeatList({ presence }: { presence: SeatPresence }) {
  const { t } = useTranslation();
  const seats = seatsOf(presence);
  const taken = seats.filter((seat) => seatInfo(presence, seat)).length;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{t('lobby.seatsTitle', { taken, total: seats.length })}</p>
      <ul className="flex flex-col gap-1 text-sm">
        {seats.map((seat) => {
          const info = seatInfo(presence, seat);
          return (
            <li key={seat} className={info ? '' : 'text-muted-foreground'}>
              {info
                ? [
                    info.name,
                    seat === presence.you ? t('lobby.seatYou') : '',
                    info.online ? '' : t('lobby.seatOffline'),
                  ]
                    .filter(Boolean)
                    .join(' ')
                : t('lobby.seatEmpty')}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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
          {presence && seatsOf(presence).length > 2 && <SeatList presence={presence} />}
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
  const offer = usePlatform((s) => s.rematch);
  if (!module || !match) return <Connecting />;
  if (seatsEmpty(presence)) return <WaitingRoom module={module} code={code} />;
  const { Board } = module;
  // An offer counts for the match on screen only.
  const rematch =
    offer?.matchId === match.matchId ? offer : { by: null, config: null, accepted: [] };
  return <Board view={match.view} presence={presence} connection={connection} rematch={rematch} />;
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
