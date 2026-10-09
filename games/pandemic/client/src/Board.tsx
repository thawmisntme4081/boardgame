// The board: the map with its tracks and piles in the middle, the actions and the hands on the
// side. It fills one window (desktop only) and never scrolls as a page. Everything it shows
// comes from the view; every button is enabled by `canActInView`, so no rule lives here.
import { CITIES, type CityId, type TableView } from '@pandemic/rules';
import type { BoardProps } from '@platform/ui/game';
import { useTranslation } from 'react-i18next';
import { ActionBar } from './components/ActionBar';
import { MoveMenu } from './components/MoveMenu';
import { MapPieces } from './components/MapPieces';
import { MapTracks } from './components/MapTracks';
import { Hands } from './components/Hands';
import { GameOverDialog } from './components/GameOverDialog';
import { EpidemicSteps } from './components/EpidemicSteps';
import { Prompts } from './components/Prompts';
import { TurnLog } from './components/TurnLog';
import { TopBar } from './components/TopBar';
import { WorldMap } from './components/WorldMap';
import { reachableCities } from './lib/moves';
import { seatName } from './lib/names';
import { usePandemic } from './store';

export function Board({ view, presence, rematch }: BoardProps<TableView>) {
  const { t } = useTranslation('pandemic');
  const selected = usePandemic((s) => s.selectedCity);
  const selectCity = usePandemic((s) => s.selectCity);
  // The last seat can be taken a moment before the game is dealt: nothing to show yet.
  if (view.status === 'waiting') return null;
  const { turn, you } = view;
  const canMoveNow =
    view.status === 'playing' && !!you && you === turn.seat && turn.step === 'actions';
  const reachable = you && canMoveNow ? reachableCities(view, you, CITIES) : new Set<CityId>();
  const turnText =
    turn.seat === you
      ? t('board.yourTurn')
      : t('board.turnOf', { name: seatName(presence, turn.seat) });
  return (
    <main className="mx-auto flex h-dvh flex-col gap-3 overflow-hidden px-3 pb-3">
      <TopBar view={view} presence={presence} />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_1fr] gap-3">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="min-h-0 flex-1">
            <WorldMap
              cures={view.cures}
              onSelect={
                canMoveNow
                  ? (city) => reachable.has(city) && selectCity(selected === city ? null : city)
                  : undefined
              }
              onBackgroundClick={() => selectCity(null)}
              selected={selected}
              reachable={reachable}
            >
              <MapTracks view={view} />
              <MapPieces view={view} presence={presence} />
              {canMoveNow && selected && you && (
                <MoveMenu view={view} you={you} city={selected} onDone={() => selectCity(null)} />
              )}
            </WorldMap>
          </div>
        </div>
        <aside className="flex min-h-0 flex-col gap-3 overflow-auto">
          <Prompts view={view} presence={presence} />
          <header className="text-sm">
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
          <EpidemicSteps view={view} />
          <GameOverDialog view={view} presence={presence} rematch={rematch} />
          {view.status === 'playing' && <ActionBar view={view} presence={presence} />}
          <Hands view={view} presence={presence} />
          <TurnLog view={view} presence={presence} />
        </aside>
      </div>
    </main>
  );
}
