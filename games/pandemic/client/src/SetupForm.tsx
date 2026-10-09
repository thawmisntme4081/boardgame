// Pandemic's lobby option for now: how many players. The platform page around it holds the name
// field and the "Create a game" button; difficulty and roles come in Pandemic 06.
import { MAX_PLAYERS, MIN_PLAYERS } from '@pandemic/rules';
import type { PandemicLobby } from '@pandemic/rules/definition';
import { Button } from '@platform/ui/components/button';
import type { SetupFormProps } from '@platform/ui/game';
import { useTranslation } from 'react-i18next';

import { DEFAULT_SETUP } from './setup';

const COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

export function SetupForm({ value, onChange }: SetupFormProps<PandemicLobby>) {
  const { t } = useTranslation('pandemic');
  const players = value.players ?? DEFAULT_SETUP.players;
  return (
    <div className="flex flex-col gap-2">
      <p id="pandemic-players" className="text-sm font-medium">
        {t('lobby.players')}
      </p>
      <div role="radiogroup" aria-labelledby="pandemic-players" className="flex gap-2">
        {COUNTS.map((count) => (
          <Button
            key={count}
            type="button"
            role="radio"
            aria-checked={players === count}
            variant={players === count ? 'default' : 'outline'}
            className="h-11 flex-1"
            onClick={() => onChange({ ...value, players: count })}
          >
            {count}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t('lobby.playersHint')}</p>
    </div>
  );
}
