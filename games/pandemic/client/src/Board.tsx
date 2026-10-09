// The board: the map with its tracks and piles in the middle, the actions on the side, the hands
// below it. It fills one window (desktop only) and never scrolls as a page. Everything it shows
// comes from the view; every button is enabled by `canActInView`, so no rule lives here.
import type { TableView } from '@pandemic/rules';
import type { BoardProps } from '@platform/ui/game';
import { useTranslation } from 'react-i18next';
import { ActionBar } from './components/ActionBar';
import { MapPieces } from './components/MapPieces';
import { MapTracks } from './components/MapTracks';
import { Hands } from './components/Hands';
import { Prompts } from './components/Prompts';
import { WorldMap } from './components/WorldMap';
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
    <main className="mx-auto flex h-dvh max-w-[90rem] flex-col gap-3 overflow-hidden p-3">
      <header className="shrink-0">
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
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_20rem] gap-3">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="min-h-0 flex-1">
            <WorldMap cures={view.cures}>
              <MapTracks view={view} />
              <MapPieces view={view} presence={presence} />
            </WorldMap>
          </div>
          <div className="max-h-44 shrink-0 overflow-auto">
            <Hands view={view} presence={presence} />
          </div>
        </div>
        <aside className="flex min-h-0 flex-col gap-3 overflow-auto">
          <Prompts view={view} presence={presence} />
          {view.status === 'playing' && <ActionBar view={view} presence={presence} />}
        </aside>
      </div>
    </main>
  );
}
