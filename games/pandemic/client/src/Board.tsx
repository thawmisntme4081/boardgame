// The plain board (Pandemic 02): lists and buttons, no map yet. Everything it shows comes from
// the view; every button is enabled by `canActInView`, so no rule lives here.
import type { TableView } from '@pandemic/rules';
import type { BoardProps } from '@platform/ui/game';
import { useTranslation } from 'react-i18next';
import { ActionBar } from './components/ActionBar';
import { Cities } from './components/Cities';
import { Hands } from './components/Hands';
import { Prompts } from './components/Prompts';
import { Tracks } from './components/Tracks';
import { seatName } from './lib/names';

export function Board({ view, presence }: BoardProps<TableView>) {
  const { t } = useTranslation('pandemic');
  // The last seat can be taken a moment before the game is dealt: nothing to show yet.
  if (view.status === 'waiting') return null;
  const { turn, you } = view;
  const turnText =
    turn.seat === you
      ? t('board.yourTurn')
      : t('board.turnOf', { name: seatName(presence, turn.seat) });
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t('board.title')}</h1>
        {view.status === 'playing' ? (
          <p>
            {turnText} · {t(`board.step.${turn.step}`)} ·{' '}
            {t('board.actionsLeft', { count: turn.actionsLeft })}
          </p>
        ) : (
          <p role="status" className="font-semibold">
            {view.status === 'won'
              ? t('board.won')
              : t('board.lost', {
                  reason: view.lossReason ? t(`board.lossReason.${view.lossReason}`) : '',
                })}
          </p>
        )}
      </header>
      <Prompts view={view} presence={presence} />
      <div className="grid gap-6 desktop:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Tracks view={view} />
          <Cities view={view} presence={presence} />
        </div>
        <div className="flex flex-col gap-6">
          <Hands view={view} presence={presence} />
          {view.status === 'playing' && <ActionBar view={view} presence={presence} />}
        </div>
      </div>
    </main>
  );
}
