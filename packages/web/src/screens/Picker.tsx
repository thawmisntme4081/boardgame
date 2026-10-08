// `/`: the game picker, and joining a room by its code.
import { Card, CardContent, CardHeader } from '@platform/ui/components/card';
import { Link } from '@tanstack/react-router';
import { ChevronRight, Dices } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GAMES } from '../games';
import { CardTop, JoinForm, NameField, Or, Shell } from './Shell';
import { useName } from './useName';

export function Picker() {
  const { t } = useTranslation();
  const { name, setName, fromAccount } = useName();
  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTop
            title={
              <>
                <Dices className="size-5 shrink-0" aria-hidden="true" /> {t('app.title')}
              </>
            }
            description={t('app.tagline')}
            account
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <section aria-labelledby="games" className="flex flex-col gap-2">
            <h2 id="games" className="text-sm font-medium">
              {t('app.chooseGame')}
            </h2>
            <ul className="flex flex-col gap-2">
              {GAMES.map((game) => (
                <li key={game.id}>
                  <Link
                    to="/play/$gameId"
                    params={{ gameId: game.id }}
                    className="flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 transition hover:bg-muted"
                  >
                    <span className="flex flex-1 flex-col gap-0.5">
                      <span className="font-semibold">
                        {t(`games.${game.id}.name` as 'games.sky-team.name')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t(`games.${game.id}.blurb` as 'games.sky-team.blurb')}
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <Or />
          <NameField name={name} onChange={setName} fromAccount={fromAccount} />
          <JoinForm name={name} />
        </CardContent>
      </Card>
    </Shell>
  );
}
