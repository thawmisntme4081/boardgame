// `/play/:gameId`: a new room for that game, with the game's own lobby options.
import { Button } from '@platform/ui/components/button';
import { Card, CardContent, CardHeader } from '@platform/ui/components/card';
import type { GameClientModule } from '@platform/ui/game';
import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRoom } from '../api';
import { gameInfo, useGameModule } from '../games';
import { CardTop, Connecting, JoinForm, NameField, Or, Shell } from './Shell';
import { useName } from './useName';

function CreateForm({ module }: { module: GameClientModule }) {
  const { t } = useTranslation();
  const { name, setName, nameOk, fromAccount } = useName();
  const [setup, setSetup] = useState(module.defaultSetup);
  const [busy, setBusy] = useState(false);
  const { SetupForm } = module;

  const create = async () => {
    setBusy(true);
    await createRoom(name.trim(), module.id, setup);
    setBusy(false);
  };

  return (
    <Shell account>
      <Card>
        <CardHeader>
          <Link
            to="/"
            className="-ml-1 flex min-h-11 w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft aria-hidden="true" className="size-4" /> {t('app.allGames')}
          </Link>
          <CardTop
            title={t(`games.${module.id}.name` as 'games.sky-team.name')}
            description={t(`games.${module.id}.blurb` as 'games.sky-team.blurb')}
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <NameField name={name} onChange={setName} fromAccount={fromAccount} />
          <JoinForm name={name} />
          <Or />
          <SetupForm value={setup} onChange={setSetup} />
          <Button
            variant="secondary"
            className="h-11"
            disabled={busy || !nameOk}
            onClick={() => void create()}
          >
            {t('lobby.create')}
          </Button>
        </CardContent>
      </Card>
    </Shell>
  );
}

export function Play({ gameId }: { gameId: string }) {
  const module = useGameModule(gameId);
  if (!gameInfo(gameId) || !module) return <Connecting />;
  return <CreateForm module={module} />;
}
