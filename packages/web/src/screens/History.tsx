// `/history`: the signed-in account's Flight Log, one section per game (each game draws its own).
import { Card, CardContent, CardHeader } from '@platform/ui/components/card';
import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GAMES, useGameModule } from '../games';
import { usePlatform } from '../store';
import { CardTop, Shell } from './Shell';

function GameHistory({ id }: { id: string }) {
  const { t } = useTranslation();
  const module = useGameModule(id);
  if (!module?.History) return null;
  return (
    <section aria-labelledby={`history-${id}`} className="flex flex-col gap-2">
      <h2 id={`history-${id}`} className="text-sm font-medium">
        {t(`games.${id}.name` as 'games.sky-team.name')}
      </h2>
      <module.History />
    </section>
  );
}

export function History() {
  const { t } = useTranslation();
  const account = usePlatform((s) => s.account);
  const signedIn = typeof account === 'object' && account.user !== null;
  return (
    <Shell wide>
      <Card>
        <CardHeader className="flex flex-col gap-1">
          <Link
            to="/"
            className="-ml-1 flex min-h-11 w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft aria-hidden="true" className="size-4" /> {t('app.allGames')}
          </Link>
          <CardTop
            title={t('history.title')}
            description={
              account === 'loading'
                ? undefined
                : t(signedIn ? 'history.intro' : 'history.signedOut')
            }
            account
          />
        </CardHeader>
        {signedIn && (
          <CardContent className="flex flex-col gap-5">
            {GAMES.map((g) => (
              <GameHistory key={g.id} id={g.id} />
            ))}
          </CardContent>
        )}
      </Card>
    </Shell>
  );
}
